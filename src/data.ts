// Client-side data layer: loads the JSON produced by the ingestion pipeline and answers every query
// the interface needs (the static-site replacement for a backend API).

import { PLACE_BY_ID, estimateTravelMinutes, mapsUrl } from "./shared/locations";
import { scoreEvent, type Relevance } from "./shared/relevance";
import { parseSearch, type SearchSpec } from "./shared/search";
import { EVENT_TYPE_LABELS, TOPIC_BY_ID, topicsFromSeriesName } from "./shared/taxonomy";
import { norm } from "./shared/text";
import { addDays, addMinutes, msToWall, nowParis, wallToMs } from "./shared/time";
import type {
  CatalogueFile, EventData, EventsFile, InstitutionData, NewsFile, NewsItem, PersonalEvent, Prefs, ResearcherData, SeriesData,
} from "./shared/types";

export interface Dataset {
  generatedAt: string;
  events: EventData[];
  eventById: Map<string, EventData>;
  catalogue: CatalogueFile;
  seriesById: Map<string, SeriesData>;
  institutionById: Map<string, InstitutionData>;
  researcherById: Map<string, ResearcherData>;
  news: NewsFile;
  haystack: Map<string, string>;
}

export interface DecoratedPlace {
  id: string;
  name: string;
  city: string;
  address: string;
  transit: string;
  zone: string;
  travel_min: number | null;
  map_url: string | null;
  directions_url: string | null;
}

export interface MathEvent extends EventData {
  relevance: Relevance;
  place: DecoratedPlace | null;
  institution: { id: string; name: string; short: string } | null;
  event_type_label: string;
}

export async function loadDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL;
  const get = async <T,>(name: string): Promise<T> => {
    const r = await fetch(`${base}data/${name}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Could not load data/${name}.json (HTTP ${r.status}). Run "npm run ingest" first.`);
    return r.json() as Promise<T>;
  };
  const [ev, catalogue, news] = await Promise.all([get<EventsFile>("events"), get<CatalogueFile>("catalogue"), get<NewsFile>("news")]);
  const institutionById = new Map(catalogue.institutions.map((i) => [i.id, i]));
  const haystack = new Map<string, string>();
  for (const e of ev.events) {
    const inst = e.institution_id ? institutionById.get(e.institution_id) : undefined;
    const place = e.location_id ? PLACE_BY_ID[e.location_id] : undefined;
    haystack.set(e.id, norm([e.title, e.speaker, e.abstract, e.series_name, inst?.short_name, inst?.name, place?.name, place?.city, e.location_text,
      ...e.topics.map((t) => TOPIC_BY_ID[t.id]?.label)].filter(Boolean).join(" \u0001 ")));
  }
  return {
    generatedAt: ev.generated_at, events: ev.events, eventById: new Map(ev.events.map((e) => [e.id, e])), catalogue,
    seriesById: new Map(catalogue.series.map((s) => [s.id, s])), institutionById,
    researcherById: new Map(catalogue.researchers.map((r) => [r.id, r])), news, haystack,
  };
}

export function originCoords(prefs: Prefs, originId?: string): [number, number] | null {
  const o = prefs.origins.find((x) => x.id === (originId ?? prefs.default_origin));
  if (!o) return null;
  if (o.lat != null && o.lon != null) return [o.lat, o.lon];
  const p = o.location_id ? PLACE_BY_ID[o.location_id] : undefined;
  return p ? [p.lat, p.lon] : null;
}

export function decorate(ds: Dataset, ev: EventData, prefs: Prefs, coords = originCoords(prefs)): MathEvent {
  const place = ev.location_id ? PLACE_BY_ID[ev.location_id] : undefined;
  const inst = ev.institution_id ? ds.institutionById.get(ev.institution_id) : undefined;
  return {
    ...ev,
    relevance: scoreEvent(ev, prefs),
    institution: inst ? { id: inst.id, name: inst.name, short: inst.short_name } : null,
    event_type_label: EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type,
    place: place
      ? {
        id: place.id, name: place.name, city: place.city, address: place.address, transit: place.transit, zone: place.zone,
        travel_min: coords ? estimateTravelMinutes(coords, place.id) : null, map_url: mapsUrl(place.id),
        directions_url: coords ? mapsUrl(place.id, coords) : null,
      }
      : null,
  };
}

function visible(ev: EventData, prefs: Prefs): boolean {
  if (ev.status === "no_session") return false;
  if (ev.status === "tba" && !prefs.show_placeholders) return false;
  if ((ev.event_type === "outreach" || ev.event_type === "training") && !prefs.show_outreach) return false;
  if (ev.outside_region && !prefs.show_outside_region) return false;
  return true;
}

/** Events overlapping [start, end] (wall-clock ISO). */
export function eventsInRange(ds: Dataset, start: string, end: string, prefs: Prefs, includeHidden = false): MathEvent[] {
  const coords = originCoords(prefs);
  return ds.events
    .filter((e) => e.start < end && (e.end ?? e.start) >= start && (includeHidden || visible(e, prefs)))
    .map((e) => decorate(ds, e, prefs, coords));
}

export function recommendations(ds: Dataset, day: string, prefs: Prefs, limit = 3): MathEvent[] {
  return eventsInRange(ds, `${day}T00:00:00`, `${day}T23:59:59`, prefs)
    .filter((e) => e.status === "scheduled" && e.relevance.score >= 30 && e.start.slice(0, 10) === day
      && !["program", "outreach", "training"].includes(e.event_type))
    .sort((a, b) => b.relevance.score - a.relevance.score)
    .slice(0, limit);
}

export function upcomingHighlyRelevant(ds: Dataset, fromDay: string, prefs: Prefs, days = 14, limit = 3): MathEvent[] {
  return eventsInRange(ds, `${addDays(`${fromDay}T00:00:00`, 1).slice(0, 10)}T00:00:00`, `${addDays(`${fromDay}T00:00:00`, days).slice(0, 10)}T23:59:59`, prefs)
    .filter((e) => e.status === "scheduled" && e.relevance.tier === "high")
    .slice(0, limit);
}

// ------------------------------------------------------------------ search

export interface SearchResult {
  spec: SearchSpec;
  events: MathEvent[];
  series: SeriesData[];
  researchers: ResearcherData[];
}

export function searchEvents(ds: Dataset, q: string, prefs: Prefs, past = false): SearchResult {
  const now = nowParis();
  const spec = parseSearch(q, now.slice(0, 10));
  const terms = spec.text.flatMap((t) => t.split(/\s+/)).filter(Boolean);
  const topicSet = new Set(spec.topics);
  const coords = originCoords(prefs);
  const results = ds.events.filter((e) => {
    if (e.status === "no_session") return false;
    if (spec.range) {
      if (e.start.slice(0, 10) < spec.range[0] || e.start.slice(0, 10) > spec.range[1]) return false;
    } else if (!past && (e.end ?? e.start) < addMinutes(now, -120)) return false;
    if (spec.weekday !== null && (new Date(wallToMs(e.start)).getUTCDay() + 6) % 7 !== spec.weekday) return false;
    if (spec.places.length || spec.institutions.length) {
      const hit = (e.location_id && spec.places.includes(e.location_id)) || (e.institution_id && spec.institutions.includes(e.institution_id));
      if (!hit) return false;
    }
    if (terms.length) {
      const hay = ds.haystack.get(e.id) ?? "";
      const textHit = terms.every((t) => hay.includes(t));
      const topicHit = topicSet.size > 0 && e.topics.some((t) => topicSet.has(t.id));
      if (!textHit && !topicHit) return false;
    }
    return true;
  });
  const events = results
    .map((e) => decorate(ds, e, prefs, coords))
    .sort((a, b) => Number(a.start < addMinutes(now, -120)) - Number(b.start < addMinutes(now, -120)) || a.start.localeCompare(b.start));
  let series: SeriesData[] = [];
  let researchers: ResearcherData[] = [];
  if (terms.length) {
    series = ds.catalogue.series
      .filter((s) => (!spec.institutions.length || spec.institutions.includes(s.institution_id ?? ""))
        && terms.every((t) => norm(`${s.name} ${s.organizers ?? ""} ${s.description ?? ""}`).includes(t)))
      .slice(0, 10);
    researchers = ds.catalogue.researchers.filter((r) => terms.every((t) => norm(r.name).includes(t))).slice(0, 10);
  }
  return { spec, events, series, researchers };
}

// ------------------------------------------------------------------ series

export interface RankedSeries extends SeriesData {
  upcoming: number;
  tba_slots: number;
  next_date: string | null;
  fit: number;
  rank_score: number;
  place: { id: string; name: string; city: string; zone: string } | null;
  allTopics: string[];
}

export function rankedSeries(ds: Dataset, prefs: Prefs): RankedSeries[] {
  const now = addMinutes(nowParis(), -180);
  const stats = new Map<string, { up: number; tba: number; next: string | null }>();
  for (const e of ds.events) {
    if (!e.series_id || e.start < now) continue;
    const s = stats.get(e.series_id) ?? { up: 0, tba: 0, next: null };
    if (e.status === "scheduled") s.up++;
    if (e.status === "tba") s.tba++;
    if ((e.status === "scheduled" || e.status === "tba") && (!s.next || e.start < s.next)) s.next = e.start;
    stats.set(e.series_id, s);
  }
  return ds.catalogue.series
    .map((s) => {
      const st = stats.get(s.id) ?? { up: 0, tba: 0, next: null };
      const allTopics = [...s.topics];
      for (const t of topicsFromSeriesName(s.name)) if (!allTopics.includes(t)) allTopics.push(t);
      const w = allTopics.map((t) => prefs.topic_weights[t] ?? 0).sort((a, b) => b - a);
      const fit = Math.min(1, (w[0] ?? 0.15) + 0.2 * (w[1] ?? 0));
      const activity = Math.min(1, (st.up + 0.3 * st.tba) / 4);
      const place = s.location_id ? PLACE_BY_ID[s.location_id] : undefined;
      return {
        ...s, allTopics, upcoming: st.up, tba_slots: st.tba, next_date: st.next, fit,
        rank_score: Math.round(1000 * fit * (0.55 + 0.45 * activity)) / 10,
        place: place ? { id: place.id, name: place.name, city: place.city, zone: place.zone } : null,
      };
    })
    .sort((a, b) => b.rank_score - a.rank_score);
}

export function seriesDetail(ds: Dataset, id: string, prefs: Prefs) {
  const series = ds.seriesById.get(id);
  if (!series) return null;
  const now = addMinutes(nowParis(), -180);
  const all = ds.events.filter((e) => e.series_id === id);
  return {
    series,
    upcoming: all.filter((e) => e.start >= now).map((e) => decorate(ds, e, prefs)),
    recent: all.filter((e) => e.start < now).reverse().slice(0, 10),
  };
}

// ------------------------------------------------------------------ researchers

export function researcherDetail(ds: Dataset, id: string, prefs: Prefs) {
  const r = ds.researcherById.get(id);
  if (!r) return null;
  const now = addMinutes(nowParis(), -180);
  const talks = ds.events.filter((e) => e.speakers.some((s) => s.id === id)).map((e) => decorate(ds, e, prefs));
  const q = encodeURIComponent(r.name);
  return {
    researcher: r,
    upcoming: talks.filter((e) => e.start >= now),
    past: talks.filter((e) => e.start < now),
    arxivSearchUrl: `https://arxiv.org/a/?searchtype=author&query=${q}`.replace("/a/?", "/search/?"),
    zbmathSearchUrl: `https://zbmath.org/authors/?q=${q}`,
  };
}

// ------------------------------------------------------------------ Math World

export function arxivScore(item: NewsItem, keywords: string[]): [number, string[]] {
  const text = norm(`${item.title} ${item.summary ?? ""}`);
  const title = norm(item.title);
  let score = 0;
  const hits: string[] = [];
  for (const k of keywords) {
    const nk = norm(k);
    if (!nk) continue;
    if (title.includes(nk)) {
      score += 3;
      hits.push(k);
    } else if (text.includes(nk)) {
      score += 1;
      hits.push(k);
    }
  }
  return [score, hits];
}

export function mathWorld(ds: Dataset, prefs: Prefs) {
  const now = nowParis();
  const newsCutoff = `${addDays(now, -75).slice(0, 10)}`;
  const news = ds.news.items.filter((n) => n.kind !== "arxiv" && (n.published ?? "") >= newsCutoff).slice(0, 4);
  const arxivCutoff = addDays(now, -4).slice(0, 10);
  const cats = new Set(prefs.arxiv_categories);
  const recentArxiv = ds.news.items.filter((n) => n.kind === "arxiv" && (n.published ?? "") >= arxivCutoff && (!cats.size || n.categories.some((c) => cats.has(c))));
  const arxiv = recentArxiv
    .map((a) => {
      const [score, matches] = arxivScore(a, prefs.arxiv_keywords);
      return { ...a, score, matches };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 4);
  const gatherings = eventsInRange(ds, now, addDays(now, 30), prefs)
    .filter((e) => ["conference", "workshop", "school", "program", "colloquium"].includes(e.event_type) && e.status === "scheduled")
    .sort((a, b) => b.relevance.score - a.relevance.score)
    .slice(0, 3);
  return { news, arxiv, arxivTotal: recentArxiv.length, gatherings, feeds: ds.news.feeds };
}

export function institutionsWithUpcoming(ds: Dataset) {
  const now = addMinutes(nowParis(), -180);
  const counts = new Map<string, number>();
  for (const e of ds.events) if (e.institution_id && e.start >= now) counts.set(e.institution_id, (counts.get(e.institution_id) ?? 0) + 1);
  return ds.catalogue.institutions
    .map((i) => ({ ...i, upcoming: counts.get(i.id) ?? 0 }))
    .sort((a, b) => a.short_name.localeCompare(b.short_name));
}

// ------------------------------------------------------------------ personal events & ICS

export function personalInRange(items: PersonalEvent[], start: string, end: string): PersonalEvent[] {
  const out: PersonalEvent[] = [];
  for (const p of items) {
    const occ = [p.start];
    if (p.weekly_until) {
      for (let k = 1; k < 60; k++) {
        const next = msToWall(wallToMs(p.start) + k * 7 * 86_400_000);
        if (next.slice(0, 10) > p.weekly_until) break;
        occ.push(next);
      }
    }
    const dur = p.end ? wallToMs(p.end) - wallToMs(p.start) : null;
    for (const o of occ) {
      const oEnd = dur !== null ? msToWall(wallToMs(o) + dur) : null;
      if (o < end && (oEnd ?? o) >= start) out.push({ ...p, start: o, end: oEnd, occurrence_of: p.id });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function eventToIcs(ev: EventData): string {
  const fmt = (s: string) => s.replace(/[-:]/g, "").slice(0, 15);
  const esc = (s: string | null) => (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paris Math Radar//EN", "BEGIN:VEVENT", `UID:${ev.id}@paris-math-radar`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    ev.all_day ? `DTSTART;VALUE=DATE:${ev.start.slice(0, 10).replace(/-/g, "")}` : `DTSTART;TZID=Europe/Paris:${fmt(ev.start)}`,
  ];
  if (ev.end && !ev.all_day) lines.push(`DTEND;TZID=Europe/Paris:${fmt(ev.end)}`);
  lines.push(`SUMMARY:${esc(ev.title + (ev.speaker ? ` — ${ev.speaker}` : ""))}`, `LOCATION:${esc(ev.location_text)}`,
    `URL:${ev.official_url ?? ""}`, `DESCRIPTION:${esc(`${ev.series_name ?? ""}\n${ev.official_url ?? ""}`)}`, "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
