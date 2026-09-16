// Shapes of the published JSON data (public/data/*.json) and of user data kept in the browser.

export type Tier = "high" | "medium" | "low" | "none";
export type EventStatus = "scheduled" | "cancelled" | "tba" | "no_session" | "possibly_removed";

export interface Evidence { field: string; term: string }
export interface EventTopic { id: string; evidence: Evidence[] }

export interface SourceRef {
  id: string;
  name: string;
  url: string | null;
  listing_url: string | null;
  reliability: string;
  last_seen: string;
  method: string;
}

export interface Change {
  event_id: string;
  detected_at: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  source_id: string | null;
}

export interface EventData {
  id: string;
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
  status: EventStatus;
  topics: EventTopic[];
  confidence: string;
  first_seen: string;
  last_verified: string;
  source_last_modified: string | null;
  speakers: { id: string; name: string }[];
  sources: SourceRef[];
  changes: Change[];
}

export interface SeriesData {
  id: string;
  name: string;
  institution_id: string | null;
  department: string | null;
  source_id: string | null;
  organizers: string | null;
  official_url: string | null;
  calendar_url: string | null;
  mailing_list: string | null;
  typical_weekday: string | null;
  typical_time: string | null;
  typical_location: string | null;
  location_id: string | null;
  recurrence: string | null;
  published_in_advance: string | null;
  has_archive: boolean | null;
  kind: string | null;
  level: string | null;
  topics: string[];
  description: string | null;
  statement_source: string | null;
  auto_discovered: boolean;
  last_seen: string | null;
}

export interface InstitutionData {
  id: string;
  name: string;
  short_name: string;
  kind: string;
  parent: string;
  url: string;
  notes: string;
}

export interface SourceData {
  id: string;
  name: string;
  institution_id: string | null;
  adapter: string | null;
  url: string;
  calendar_url: string | null;
  extraction_method: string;
  reliability: string;
  update_frequency: string | null;
  notes: string | null;
  status: string;
  last_check: string | null;
  last_success: string | null;
  last_error: string | null;
  events_found: number | null;
  upcoming_found: number | null;
  last_duration_ms: number | null;
}

export interface ResearcherData {
  id: string;
  name: string;
  affiliation: string | null;
  homepage: string | null;
}

export interface NewsItem {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  authors: string | null;
  categories: string[];
  published: string | null;
}

export interface FeedStatus {
  id: string;
  name: string;
  url: string;
  kind: string;
  status: string;
  last_check: string | null;
  last_error: string | null;
  items_found: number | null;
}

export interface CatalogueFile {
  generated_at: string;
  institutions: InstitutionData[];
  series: SeriesData[];
  sources: SourceData[];
  researchers: ResearcherData[];
  recent_changes: Change[];
}

export interface EventsFile {
  generated_at: string;
  events: EventData[];
}

export interface NewsFile {
  generated_at: string;
  arxiv_categories: string[];
  items: NewsItem[];
  feeds: FeedStatus[];
}

// ------------------------------------------------------------------ user data (browser)

export interface Origin {
  id: string;
  label: string;
  location_id: string | null;
  lat: number | null;
  lon: number | null;
}

export interface Prefs {
  topic_weights: Record<string, number>;
  followed_series: string[];
  followed_institutions: string[];
  followed_researchers: string[];
  followed_topics: string[];
  origins: Origin[];
  default_origin: string;
  arxiv_categories: string[];
  arxiv_keywords: string[];
  show_placeholders: boolean;
  show_outside_region: boolean;
  show_outreach: boolean;
  day_start_hour: number;
  day_end_hour: number;
}

export interface PersonalEvent {
  id: number;
  title: string;
  kind: string;
  start: string;
  end: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  weekly_until: string | null;
  occurrence_of?: number;
}

export interface ResearchItem {
  id: number;
  kind: "project" | "task" | "note" | "paper";
  title: string;
  body: string | null;
  url: string | null;
  done: boolean;
  created: string;
  updated: string;
}
