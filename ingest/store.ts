// JSON "database": data/store.json holds the pipeline state (committed); public/data/*.json are generated
// for the web app (not committed). Keeps every source record so merges and change detection stay reproducible.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CatalogueFile, Change, EventData, EventsFile, FeedStatus, NewsFile, NewsItem, ResearcherData, SeriesData, SourceData, SourceRef,
} from "../src/shared/types";
import { addDays, nowParis, nowUtcIso } from "../src/shared/time";
import { ARXIV_CATEGORIES, INSTITUTIONS, SERIES, SOURCES } from "./catalogue";
import type { RawSeries, SourceDef } from "./models";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const STORE_PATH = join(ROOT, "data", "store.json");
export const PUBLIC_DIR = join(ROOT, "public", "data");

export interface NormRec {
  title: string;
  speaker: string | null;
  speaker_affiliation: string | null;
  speaker_url: string | null;
  abstract: string | null;
  start: string;
  end: string | null;
  all_day: boolean;
  location_text: string | null;
  building: string | null;
  room: string | null;
  location_id: string | null;
  location_basis: string | null;
  outside_region: boolean;
  institution_id: string | null;
  department: string | null;
  series_id: string | null;
  series_name: string | null;
  event_type: string;
  organizer: string | null;
  official_url: string | null;
  online_url: string | null;
  registration_required: boolean | null;
  status: string | null;
  source_last_modified: string | null;
  weak: boolean;
}

export interface RecordRow {
  event_id: string;
  source_id: string;
  external_id: string;
  source_url: string | null;
  reliability: string;
  first_seen: string;
  last_seen: string;
  rec: NormRec;
}

export type StoredEvent = Omit<EventData, "sources" | "changes"> & { content_hash: string };

export interface SourceStatus {
  status: string;
  last_check: string | null;
  last_success: string | null;
  last_error: string | null;
  events_found: number | null;
  upcoming_found: number | null;
  last_duration_ms: number | null;
}

export interface Run {
  source_id: string;
  started_at: string;
  finished_at: string;
  status: string;
  n_events: number;
  n_new: number;
  n_updated: number;
  message: string;
}

export interface Store {
  version: 1;
  updated_at: string | null;
  events: Record<string, StoredEvent>;
  records: Record<string, RecordRow>;
  changes: Change[];
  series: Record<string, SeriesData>;
  source_status: Record<string, SourceStatus>;
  runs: Run[];
  researchers: Record<string, ResearcherData>;
  news: Record<string, NewsItem>;
  feeds: Record<string, FeedStatus>;
}

export function loadStore(): Store {
  const empty: Store = {
    version: 1, updated_at: null, events: {}, records: {}, changes: [], series: {}, source_status: {}, runs: [], researchers: {}, news: {}, feeds: {},
  };
  const store: Store = existsSync(STORE_PATH) ? { ...empty, ...JSON.parse(readFileSync(STORE_PATH, "utf8")) } : empty;
  seedCatalogue(store);
  return store;
}

function sortedObject<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

export function saveStore(store: Store): void {
  store.updated_at = nowUtcIso();
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const out = { ...store, events: sortedObject(store.events), records: sortedObject(store.records), series: sortedObject(store.series),
    source_status: sortedObject(store.source_status), researchers: sortedObject(store.researchers), news: sortedObject(store.news),
    feeds: sortedObject(store.feeds) };
  writeFileSync(STORE_PATH, JSON.stringify(out, null, 1) + "\n");
}

// ------------------------------------------------------------------ series

const SERIES_FIELDS = ["name", "institution_id", "department", "source_id", "organizers", "official_url", "calendar_url", "mailing_list",
  "typical_weekday", "typical_time", "typical_location", "location_id", "recurrence", "published_in_advance", "has_archive", "kind", "level",
  "topics", "description", "statement_source"] as const;

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/** Insert or update a series. Discovered data never overwrites a curated non-empty field. */
export function upsertSeries(store: Store, data: RawSeries, curated: boolean): void {
  const row = store.series[data.id] as unknown as Record<string, unknown> | undefined;
  if (!row) {
    const s: Record<string, unknown> = { id: data.id, auto_discovered: !curated, last_seen: nowUtcIso() };
    for (const k of SERIES_FIELDS) s[k] = (data as unknown as Record<string, unknown>)[k] ?? (k === "topics" ? [] : null);
    store.series[data.id] = s as unknown as SeriesData;
    return;
  }
  for (const k of SERIES_FIELDS) {
    const v = (data as unknown as Record<string, unknown>)[k];
    if (isEmpty(v)) continue;
    if (curated || row.auto_discovered || isEmpty(row[k])) row[k] = v;
  }
  if (curated) row.auto_discovered = false;
  row.last_seen = nowUtcIso();
}

export function seedCatalogue(store: Store): void {
  for (const s of SOURCES) {
    store.source_status[s.id] ??= {
      status: s.adapter ? "never_run" : "manual", last_check: null, last_success: null, last_error: null, events_found: null,
      upcoming_found: null, last_duration_ms: null,
    };
  }
  for (const s of SERIES) upsertSeries(store, s, true);
}

// ------------------------------------------------------------------ pruning & export

export function prune(store: Store, keepPastDays = 200): void {
  const cutoff = addDays(nowParis(), -keepPastDays);
  const gone = new Set(Object.values(store.events).filter((e) => (e.end ?? e.start) < cutoff).map((e) => e.id));
  for (const id of gone) delete store.events[id];
  for (const [k, r] of Object.entries(store.records)) if (gone.has(r.event_id) || !store.events[r.event_id]) delete store.records[k];
  store.changes = store.changes.filter((c) => store.events[c.event_id]).slice(-2000);
  store.runs = store.runs.slice(-400);
  const referenced = new Set(Object.values(store.events).flatMap((e) => e.speakers.map((s) => s.id)));
  for (const id of Object.keys(store.researchers)) if (!referenced.has(id)) delete store.researchers[id];
  const newsCutoff = addDays(nowParis(), -150);
  for (const [id, n] of Object.entries(store.news)) {
    const keepDays = n.kind === "arxiv" ? -8 : -150;
    if (!n.published || n.published.slice(0, 19) < addDays(nowParis(), keepDays) || n.published < newsCutoff) delete store.news[id];
  }
}

const SOURCE_BY_ID: Record<string, SourceDef> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export function exportPublic(store: Store): void {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const generated_at = store.updated_at ?? nowUtcIso();
  const sourcesByEvent = new Map<string, SourceRef[]>();
  for (const r of Object.values(store.records)) {
    const def = SOURCE_BY_ID[r.source_id];
    const list = sourcesByEvent.get(r.event_id) ?? [];
    list.push({ id: r.source_id, name: def?.name ?? r.source_id, url: r.rec.official_url ?? r.source_url, listing_url: r.source_url,
      reliability: r.reliability, last_seen: r.last_seen, method: def?.extraction_method ?? "" });
    sourcesByEvent.set(r.event_id, list);
  }
  const changesByEvent = new Map<string, Change[]>();
  for (const c of store.changes) changesByEvent.set(c.event_id, [...(changesByEvent.get(c.event_id) ?? []), c]);

  const events: EventData[] = Object.values(store.events)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ content_hash: _h, ...e }) => ({
      ...e,
      sources: (sourcesByEvent.get(e.id) ?? []).sort((a, b) => a.id.localeCompare(b.id)),
      changes: (changesByEvent.get(e.id) ?? []).slice(-10).reverse(),
    }));
  const eventsFile: EventsFile = { generated_at, events };

  const sources: SourceData[] = SOURCES.map((s) => ({
    id: s.id, name: s.name, institution_id: s.institution_id, adapter: s.adapter, url: s.url, calendar_url: s.calendar_url,
    extraction_method: s.extraction_method, reliability: s.reliability, update_frequency: s.update_frequency, notes: s.notes,
    ...store.source_status[s.id],
  }));
  const catalogue: CatalogueFile = {
    generated_at, institutions: INSTITUTIONS, series: Object.values(store.series).sort((a, b) => a.name.localeCompare(b.name)), sources,
    researchers: Object.values(store.researchers), recent_changes: store.changes.slice(-50).reverse(),
  };
  const news: NewsFile = {
    generated_at, arxiv_categories: ARXIV_CATEGORIES,
    items: Object.values(store.news).sort((a, b) => (b.published ?? "").localeCompare(a.published ?? "")),
    feeds: Object.values(store.feeds),
  };
  writeFileSync(join(PUBLIC_DIR, "events.json"), JSON.stringify(eventsFile));
  writeFileSync(join(PUBLIC_DIR, "catalogue.json"), JSON.stringify(catalogue));
  writeFileSync(join(PUBLIC_DIR, "news.json"), JSON.stringify(news));
}
