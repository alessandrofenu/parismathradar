// Generic iCalendar adapter (IRIF, public Google Calendars).
// params: url, series_id, location_hint, official_url, summary_is_speaker, speaker_after_dash

import { CANCEL_RE, NO_SESSION_RE } from "../../src/shared/text";
import { addDays, nowParis } from "../../src/shared/time";
import { icsDate, icsText, parseIcs } from "../ics";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, htmlToText, httpGet } from "../util";

export function splitSpeaker(text: string): [string | null, string | null] {
  const t = text.trim().replace(/^[,;]+|[,;]+$/g, "").trim();
  const m = t.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) return [m[1].trim() || null, m[2].trim() || null];
  const i = t.indexOf(",");
  if (i >= 0) return [t.slice(0, i).trim() || null, t.slice(i + 1).trim() || null];
  return [t || null, null];
}

export const ical: Adapter = async (source, params) => {
  const res = emptyResult();
  const f = await httpGet(params.url);
  if (f.status === 429) {
    res.status_override = "warning";
    res.message = "Rate-limited by the calendar host (HTTP 429); will retry at the next run.";
    return res;
  }
  if (f.status !== 200) throw new Error(`HTTP ${f.status} for ${params.url}`);
  const now = nowParis();
  const lo = addDays(now, -14), hi = addDays(now, 400);
  const seenUids = new Map<string, number>();
  let latest: string | null = null;
  for (const ev of parseIcs(f.text)) {
    const s = icsDate(ev, "DTSTART");
    if (!s) continue;
    const [start, allDay] = s;
    if (!latest || start > latest) latest = start;
    if (start < lo || start > hi) continue;
    if (ev.RRULE) {
      res.warnings.push("Recurring VEVENT (RRULE) ignored: only explicit occurrences are imported.");
      continue;
    }
    const end = icsDate(ev, "DTEND")?.[0] ?? null;
    const summary = cleanWs(icsText(ev, "SUMMARY")) ?? "";
    let desc = cleanWs(icsText(ev, "DESCRIPTION"));
    if (desc && /<[a-z][\s\S]*>/i.test(desc)) desc = htmlToText(desc);
    const location = cleanWs(icsText(ev, "LOCATION"));
    const url = icsText(ev, "URL")?.trim() || null;
    const uid = icsText(ev, "UID") ?? `${summary}|${start}`;
    const n = seenUids.get(uid) ?? 0;
    seenUids.set(uid, n + 1);

    let title = summary;
    let speaker: string | null = null, aff: string | null = null;
    let weak = false;
    if (params.summary_is_speaker) {
      [speaker, aff] = splitSpeaker(summary);
      weak = true;
    } else if (params.speaker_after_dash) {
      const m = summary.match(/^(.*)\s+[-–]\s+([^-–]+)$/);
      if (m) {
        title = m[1].trim();
        [speaker, aff] = splitSpeaker(m[2]);
      }
    }
    const status = CANCEL_RE.test(summary) ? "cancelled" : NO_SESSION_RE.test(summary) ? "no_session" : null;
    const room = location && /^(salle|room|amphi)\b/i.test(location) && location.length < 40 ? location : null;
    res.events.push({
      external_id: n === 0 ? uid : `${uid}#${start}`, title: title || "(untitled)", start, end, all_day: allDay, speaker,
      speaker_affiliation: aff, abstract: desc, location_text: location, room, location_hint: params.location_hint ?? null,
      series_id: params.series_id ?? null, institution_id: source.institution_id, official_url: url ?? params.official_url ?? null,
      source_url: params.official_url ?? source.url, status, weak, source_last_modified: f.lastModified,
    });
  }
  res.warnings = [...new Set(res.warnings)];
  res.complete_window = [now, hi];
  if (!res.events.length && latest && latest < addDays(now, -180)) {
    res.status_override = "stale";
    res.message = `Calendar reachable but its latest entry is ${latest.slice(0, 10)}; it no longer seems to be maintained.`;
  }
  return res;
};
