// Records exchanged between adapters and the pipeline. Times are Paris wall-clock ISO strings.

export interface RawEvent {
  external_id: string;
  title: string;
  start: string;
  end?: string | null;
  all_day?: boolean;
  speaker?: string | null;
  speaker_affiliation?: string | null;
  speaker_url?: string | null;
  abstract?: string | null;
  location_text?: string | null;
  room?: string | null;
  building?: string | null;
  /** gazetteer id when the *source* identifies the site (site-specific calendar) */
  location_hint?: string | null;
  series_id?: string | null;
  series_name?: string | null;
  department?: string | null;
  institution_id?: string | null;
  event_type?: string | null;
  official_url?: string | null;
  source_url?: string | null;
  online_url?: string | null;
  organizer?: string | null;
  registration_required?: boolean | null;
  status?: "cancelled" | "tba" | "no_session" | null;
  source_last_modified?: string | null;
  /** only a speaker name is known (e.g. a Google Calendar storing names only) */
  weak?: boolean;
}

export interface RawSeries {
  id: string;
  name: string;
  institution_id?: string | null;
  department?: string | null;
  source_id?: string | null;
  organizers?: string | null;
  official_url?: string | null;
  calendar_url?: string | null;
  mailing_list?: string | null;
  typical_weekday?: string | null;
  typical_time?: string | null;
  typical_location?: string | null;
  location_id?: string | null;
  recurrence?: string | null;
  published_in_advance?: string | null;
  has_archive?: boolean | null;
  kind?: string | null;
  level?: string | null;
  topics?: string[];
  description?: string | null;
  statement_source?: string | null;
}

export interface AdapterResult {
  events: RawEvent[];
  series: RawSeries[];
  warnings: string[];
  /** if the adapter saw the complete list of future events in this window, vanished events can be flagged */
  complete_window?: [string, string];
  status_override?: "blocked" | "stale" | "manual" | "warning";
  message?: string;
}

export const emptyResult = (): AdapterResult => ({ events: [], series: [], warnings: [] });

export interface SourceDef {
  id: string;
  name: string;
  institution_id: string;
  adapter: string | null;
  params: Record<string, any>;
  url: string;
  calendar_url: string | null;
  extraction_method: string;
  reliability: "very_high" | "high" | "medium_high" | "medium" | "low";
  update_frequency: string;
  notes: string;
}

export type Adapter = (source: SourceDef, params: Record<string, any>) => Promise<AdapterResult>;
