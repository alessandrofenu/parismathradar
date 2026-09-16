// Ingestion pipeline: adapters → normalisation → dedup/merge → classification → store.
// Merges are recomputed from *all* source records attached to an event, so results are deterministic
// and every original record is kept.

import { isOutsideRegion, matchLocation } from "../src/shared/locations";
import { TOPIC_BY_ID, classifyText, detectEventType, topicsFromSeriesName, withParents } from "../src/shared/taxonomy";
import { isPlaceholder, norm, slug } from "../src/shared/text";
import { addMinutes, minutesBetween, nowParis, nowUtcIso } from "../src/shared/time";
import type { EventStatus, EventTopic, Evidence } from "../src/shared/types";
import { ADAPTERS } from "./adapters";
import { SOURCES } from "./catalogue";
import { partialRatio, tokenSetRatio, tokenSortRatio } from "./fuzz";
import type { RawEvent, SourceDef } from "./models";
import { upsertSeries, type NormRec, type RecordRow, type Store, type StoredEvent } from "./store";
import { errMessage, sha } from "./util";

const RANK: Record<string, number> = { very_high: 5, high: 4, medium_high: 3, medium: 2, low: 1 };
const TRACKED = ["title", "speaker", "start", "end", "room", "location_text", "status"] as const;
export const SOURCE_BY_ID: Record<string, SourceDef> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const recKey = (sourceId: string, ext: string) => `${sourceId}::${ext}`;
const normUrl = (u: string | null | undefined) => (u ?? "").trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
type Log = (msg: string) => void;

export class Pipeline {
  private byEvent = new Map<string, Set<string>>();
  private byDay = new Map<string, Set<string>>();

  constructor(public store: Store) {
    for (const [k, r] of Object.entries(store.records)) this.link(k, r.event_id);
    for (const e of Object.values(store.events)) this.dayAdd(e.id, e.start);
  }

  private link(key: string, eid: string) {
    if (!this.byEvent.has(eid)) this.byEvent.set(eid, new Set());
    this.byEvent.get(eid)!.add(key);
  }
  private dayAdd(eid: string, start: string) {
    const d = start.slice(0, 10);
    if (!this.byDay.has(d)) this.byDay.set(d, new Set());
    this.byDay.get(d)!.add(eid);
  }
  private dayRemove(eid: string, start: string) {
    this.byDay.get(start.slice(0, 10))?.delete(eid);
  }
  private recordsOf(eid: string): RecordRow[] {
    return [...(this.byEvent.get(eid) ?? [])].map((k) => this.store.records[k]).filter(Boolean);
  }

  // ---------------------------------------------------------------- normalisation

  normalize(raw: RawEvent, source: SourceDef): NormRec {
    const series = raw.series_id ? this.store.series[raw.series_id] : undefined;
    let loc = matchLocation(raw.location_text, raw.building, raw.room && raw.room.length > 6 ? raw.room : null);
    let basis: string | null = loc ? "source text" : null;
    if (!loc && raw.location_hint) [loc, basis] = [raw.location_hint, "source (site-specific calendar)"];
    if (!loc && series?.location_id && !raw.location_text) [loc, basis] = [series.location_id, "series catalogue"];
    const title = raw.title.trim();
    return {
      title, speaker: raw.speaker ?? null, speaker_affiliation: raw.speaker_affiliation ?? null, speaker_url: raw.speaker_url ?? null,
      abstract: raw.abstract ?? null, start: raw.start, end: raw.end ?? null, all_day: !!raw.all_day, location_text: raw.location_text ?? null,
      building: raw.building ?? null, room: raw.room ?? null, location_id: loc, location_basis: basis,
      outside_region: !!raw.location_text && !loc && isOutsideRegion(raw.location_text),
      institution_id: raw.institution_id ?? source.institution_id, department: raw.department ?? null, series_id: raw.series_id ?? null,
      series_name: raw.series_name ?? series?.name ?? null,
      event_type: raw.event_type ?? detectEventType(raw.series_name, title) ?? "seminar", organizer: raw.organizer ?? null,
      official_url: raw.official_url ?? null, online_url: raw.online_url ?? null, registration_required: raw.registration_required ?? null,
      status: raw.status ?? (isPlaceholder(title) && !raw.speaker ? "tba" : null), source_last_modified: raw.source_last_modified ?? null,
      weak: !!raw.weak,
    };
  }

  // ---------------------------------------------------------------- deduplication

  findDuplicate(rec: NormRec, sourceId: string): string | null {
    const cands = [...(this.byDay.get(rec.start.slice(0, 10)) ?? [])]
      .map((id) => this.store.events[id])
      .filter((e) => e && !this.recordsOf(e.id).some((r) => r.source_id === sourceId));
    let best: string | null = null, bestScore = 0;
    for (const c of cands) {
      if (rec.official_url && normUrl(rec.official_url) === normUrl(c.official_url)) return c.id;
      if (rec.official_url && this.recordsOf(c.id).some((r) => normUrl(r.rec.official_url) === normUrl(rec.official_url))) return c.id;
      if (rec.all_day && c.all_day && !isPlaceholder(rec.title) && rec.title.length > 12 && tokenSetRatio(norm(rec.title), norm(c.title)) >= 90) {
        return c.id;
      }
      const diff = Math.abs(minutesBetween(rec.start, c.start));
      if (!(diff <= 45 || rec.all_day !== c.all_day)) continue;
      if (rec.location_id && c.location_id && rec.location_id !== c.location_id) continue;
      let sp = rec.speaker && c.speaker ? tokenSortRatio(norm(rec.speaker), norm(c.speaker)) : 0;
      const t1 = norm(rec.title), t2 = norm(c.title);
      const ti = !isPlaceholder(rec.title) && !isPlaceholder(c.title) ? tokenSetRatio(t1, t2) : 0;
      if (rec.weak) sp = Math.max(sp, partialRatio(norm(rec.speaker ?? rec.title), norm(`${c.speaker ?? ""} ${c.title}`)));
      const exact = diff <= 5;
      if (exact && t1 && t1 === t2 && !isPlaceholder(rec.title)) return c.id; // identical title, same time & campus
      let score = 0;
      if (sp >= 88 && (ti >= 60 || exact)) score = 0.9 + sp / 1000;
      else if (ti >= 93 && t1.length > 14 && (exact || sp >= 70)) score = 0.85 + ti / 1000;
      else if (rec.weak && sp >= 85 && exact) score = 0.8;
      else if (rec.series_id && rec.series_id === c.series_id && exact) score = 0.95;
      if (score > bestScore) [best, bestScore] = [c.id, score];
    }
    return best;
  }

  // ---------------------------------------------------------------- merge

  private merge(rows: RecordRow[]) {
    const richness = (r: NormRec) => Object.values(r).filter((v) => v !== null && v !== "" && v !== false).length;
    const ranked = [...rows].sort((a, b) =>
      Number(a.rec.weak) - Number(b.rec.weak) || (RANK[b.reliability] ?? 0) - (RANK[a.reliability] ?? 0) || richness(b.rec) - richness(a.rec));
    const anyRealTitle = ranked.some((r) => !isPlaceholder(r.rec.title) && !r.rec.weak);
    const pick = <K extends keyof NormRec>(f: K): NormRec[K] | null => {
      for (const r of ranked) {
        const v = r.rec[f];
        if (f === "title" && isPlaceholder(v as string) && anyRealTitle) continue;
        if (v !== null && v !== undefined && v !== "") return v;
      }
      return null;
    };
    const strong = ranked.filter((r) => !r.rec.weak);
    let title = (pick("title") as string | null) ?? "TBA";
    const weakTitle = ranked.find((r) => r.rec.weak)?.rec.title;
    if (strong.length && title === weakTitle) title = strong[0].rec.title || "TBA";
    const statuses = (strong.length ? strong : ranked).map((r) => r.rec.status);
    let status: EventStatus = "scheduled";
    if (statuses.includes("cancelled")) status = "cancelled";
    else if (statuses.length && statuses.every((s) => s === "no_session")) status = "no_session";
    else if (pick("speaker") && statuses.every((s) => s === "tba" || s === null)) status = "scheduled";
    else if (statuses.length && statuses.every((s) => s === "tba")) status = "tba";
    const bestRel = Math.max(0, ...strong.map((r) => RANK[r.reliability] ?? 0));
    const confidence = bestRel ? Object.entries(RANK).find(([, v]) => v === bestRel)![0] : "medium";
    return {
      title, status, confidence, outside_region: ranked.every((r) => r.rec.outside_region),
      speaker: pick("speaker") as string | null, speaker_affiliation: pick("speaker_affiliation") as string | null,
      speaker_url: pick("speaker_url") as string | null, abstract: pick("abstract") as string | null, start: ranked[0].rec.start,
      end: pick("end") as string | null, all_day: ranked[0].rec.all_day, location_text: pick("location_text") as string | null,
      building: pick("building") as string | null, room: pick("room") as string | null, location_id: pick("location_id") as string | null,
      location_basis: pick("location_basis") as string | null, institution_id: pick("institution_id") as string | null,
      department: pick("department") as string | null, series_id: pick("series_id") as string | null,
      series_name: pick("series_name") as string | null, event_type: (pick("event_type") as string | null) ?? "seminar",
      organizer: pick("organizer") as string | null, official_url: pick("official_url") as string | null,
      online_url: pick("online_url") as string | null, registration_required: pick("registration_required") as boolean | null,
      source_last_modified: pick("source_last_modified") as string | null,
    };
  }

  private computeTopics(ev: { title: string; abstract: string | null; series_id: string | null; series_name: string | null; event_type: string }): EventTopic[] {
    const found: Record<string, Evidence[]> = classifyText(ev.title, ev.abstract);
    const series = ev.series_id ? this.store.series[ev.series_id] : undefined;
    if (series) for (const t of series.topics) (found[t] ??= []).push({ field: "series", term: series.name });
    for (const t of topicsFromSeriesName(ev.series_name)) {
      if (!(found[t] ?? []).some((e) => e.field === "series")) (found[t] ??= []).push({ field: "series_name", term: ev.series_name! });
    }
    for (const child of Object.keys(found)) {
      for (const parent of withParents([child]).slice(1)) if (!found[parent]) found[parent] = [{ field: "parent", term: child }];
    }
    if (!Object.keys(found).length && ev.event_type === "colloquium") found.general = [{ field: "event_type", term: "colloquium" }];
    return Object.entries(found).filter(([id]) => TOPIC_BY_ID[id]).map(([id, evidence]) => ({ id, evidence }));
  }

  private linkSpeakers(speaker: string | null, affiliation: string | null, homepage: string | null) {
    if (!speaker || isPlaceholder(speaker)) return [];
    const names = speaker.split(/\s*(?:,|;|&|\bet\b|\band\b)\s*/).filter((n) => n && n.length > 3 && n.split(/\s+/).length <= 5);
    const out: { id: string; name: string }[] = [];
    for (const n of names) {
      const id = slug(n);
      if (!id || id === "tba" || id === "tbd") continue;
      const single = names.length === 1;
      const old = this.store.researchers[id];
      this.store.researchers[id] = {
        id, name: old?.name ?? n, affiliation: (single ? affiliation : null) ?? old?.affiliation ?? null,
        homepage: old?.homepage ?? (single ? homepage : null) ?? null,
      };
      if (!out.some((s) => s.id === id)) out.push({ id, name: n });
    }
    return out;
  }

  rebuildEvent(eid: string, verified: boolean): "new" | "updated" | "unchanged" {
    const rows = this.recordsOf(eid);
    const old = this.store.events[eid];
    if (!rows.length) {
      if (old) {
        this.dayRemove(eid, old.start);
        delete this.store.events[eid];
      }
      return "unchanged";
    }
    const m = this.merge(rows);
    const status: EventStatus = old?.status === "possibly_removed" && !verified ? "possibly_removed" : m.status;
    const now = nowUtcIso();
    const topics = this.computeTopics(m);
    const speakers = this.linkSpeakers(m.speaker, m.speaker_affiliation, m.speaker_url);
    const hash = sha(m.title, m.speaker, m.start, m.end, m.room, m.location_text, status, m.abstract);
    const ev: StoredEvent = {
      id: eid, title: m.title, speaker: m.speaker, speaker_affiliation: m.speaker_affiliation, speaker_url: m.speaker_url, abstract: m.abstract,
      start: m.start, end: m.end, all_day: m.all_day, location_text: m.location_text, building: m.building, room: m.room,
      location_id: m.location_id, location_basis: m.location_basis, outside_region: m.outside_region, institution_id: m.institution_id,
      department: m.department, series_id: m.series_id, series_name: m.series_name, event_type: m.event_type, organizer: m.organizer,
      official_url: m.official_url, online_url: m.online_url, registration_required: m.registration_required, status, topics,
      confidence: m.confidence, first_seen: old?.first_seen ?? now, last_verified: verified || !old ? now : old.last_verified,
      source_last_modified: m.source_last_modified, speakers, content_hash: hash,
    };
    if (old) this.dayRemove(eid, old.start);
    this.dayAdd(eid, ev.start);
    this.store.events[eid] = ev;
    return !old ? "new" : old.content_hash !== hash ? "updated" : "unchanged";
  }

  ingestRecord(source: SourceDef, raw: RawEvent): "new" | "updated" | "unchanged" {
    const rec = this.normalize(raw, source);
    const now = nowUtcIso();
    const key = recKey(source.id, raw.external_id);
    const row = this.store.records[key];
    let eid: string;
    if (row) {
      eid = row.event_id;
      for (const f of TRACKED) { // field-level changes reported by the same source
        let ov = row.rec[f] as string | null, nv = rec[f] as string | null;
        if (f === "status") {
          ov = ov ?? "scheduled";
          nv = nv ?? "scheduled";
          if (ov === "tba") continue; // a slot getting its speaker is an announcement, not a modification
        }
        if (ov == null || ov === "" || ov === nv || isPlaceholder(ov)) continue;
        this.store.changes.push({ event_id: eid, detected_at: now, field: f, old_value: String(ov), new_value: nv == null ? null : String(nv), source_id: source.id });
      }
      Object.assign(row, { rec, last_seen: now, source_url: raw.source_url ?? null, reliability: source.reliability });
    } else {
      eid = this.findDuplicate(rec, source.id) ?? sha(source.id, raw.external_id);
      this.store.records[key] = { event_id: eid, source_id: source.id, external_id: raw.external_id, source_url: raw.source_url ?? null,
        reliability: source.reliability, first_seen: now, last_seen: now, rec };
      this.link(key, eid);
    }
    return this.rebuildEvent(eid, true);
  }

  // ---------------------------------------------------------------- source runs

  async runSource(sourceId: string, log: Log = console.log) {
    const source = SOURCE_BY_ID[sourceId];
    if (!source) throw new Error(`unknown source ${sourceId}`);
    if (!source.adapter) return { source: sourceId, status: "manual" };
    const st = this.store.source_status[sourceId];
    const started = nowUtcIso();
    const t0 = Date.now();
    let result;
    try {
      result = await ADAPTERS[source.adapter](source, source.params);
    } catch (e) {
      const msg = errMessage(e);
      Object.assign(st, { status: "error", last_check: nowUtcIso(), last_error: msg.slice(0, 1000), last_duration_ms: Date.now() - t0 });
      this.store.runs.push({ source_id: sourceId, started_at: started, finished_at: nowUtcIso(), status: "error", n_events: 0, n_new: 0, n_updated: 0, message: msg });
      log(`  ✗ ${sourceId}: ${msg}`);
      return { source: sourceId, status: "error" };
    }
    for (const s of result.series) upsertSeries(this.store, { ...s, source_id: sourceId }, false);
    const stats = { new: 0, updated: 0, unchanged: 0 };
    const seen = new Set<string>();
    const now = nowParis();
    let upcoming = 0;
    for (const raw of result.events) {
      try {
        stats[this.ingestRecord(source, raw)]++;
        seen.add(raw.external_id);
        if (raw.start >= addMinutes(now, -180)) upcoming++;
      } catch (e) {
        result.warnings.push(`record ${raw.external_id}: ${errMessage(e)}`);
      }
    }
    let removed = 0;
    if (result.complete_window) {
      const [lo, hi] = result.complete_window;
      for (const r of Object.values(this.store.records)) {
        if (r.source_id !== sourceId || seen.has(r.external_id)) continue;
        const ev = this.store.events[r.event_id];
        if (!ev || ev.start < lo || ev.start > hi || ev.status === "cancelled" || ev.status === "possibly_removed") continue;
        if (this.recordsOf(ev.id).some((x) => x.source_id !== sourceId)) continue;
        ev.status = "possibly_removed";
        this.store.changes.push({ event_id: ev.id, detected_at: nowUtcIso(), field: "status", old_value: "scheduled", new_value: "possibly_removed", source_id: sourceId });
        removed++;
      }
    }
    const status = result.status_override ?? (result.warnings.length ? "warning" : "ok");
    let message = result.message ?? "";
    if (result.warnings.length) message += `${message ? " | " : ""}${result.warnings.length} warning(s): ${result.warnings.slice(0, 5).join("; ")}`;
    if (removed) message += ` | ${removed} previously listed event(s) no longer on the source`;
    const dur = Date.now() - t0;
    Object.assign(st, {
      status, last_check: nowUtcIso(), last_success: nowUtcIso(), last_error: message.slice(0, 2000) || null,
      events_found: result.events.length, upcoming_found: upcoming, last_duration_ms: dur,
    });
    this.store.runs.push({ source_id: sourceId, started_at: started, finished_at: nowUtcIso(), status, n_events: result.events.length,
      n_new: stats.new, n_updated: stats.updated, message: message.slice(0, 4000) });
    log(`  ${status === "ok" ? "✓" : "!"} ${sourceId}: ${status} — ${result.events.length} events (${stats.new} new, ${stats.updated} updated), `
      + `${result.series.length} series, ${dur} ms${message ? ` — ${message.slice(0, 160)}` : ""}`);
    return { source: sourceId, status, ...stats };
  }

  async runAll(only: string[] | null, log: Log = console.log) {
    let ids = SOURCES.filter((s) => s.adapter).map((s) => s.id);
    if (only?.length) ids = ids.filter((id) => only.some((o) => (o.endsWith("*") ? id.startsWith(o.slice(0, -1)) : id === o)));
    const order: Record<string, number> = { "ihp-recurrent": 0, "imj-gestion": 1, "ens-dma": 2, "imo-orsay": 3, "ihes-events": 4 };
    const rank = (id: string) => order[id] ?? (id.startsWith("indico") ? 6 : id.startsWith("gcal") || id === "ihp-agenda" ? 7 : 5);
    ids.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const out = [];
    for (const id of ids) out.push(await this.runSource(id, log));
    return out;
  }

  reclassifyAll(): number {
    const ids = Object.keys(this.store.events);
    for (const id of ids) this.rebuildEvent(id, false);
    return ids.length;
  }
}
