// Séminaire de Géométrie et Dynamique de Cergy-Pontoise, maintained by an organiser (https://louisioos.github.io/liens.html).
// The official AGM pages stopped in 2024; this page carries the current programme:
//   <B>11h à 12h</B>, en salle 5.54 du bâtiment E …            (weekly slot, stated once for the year)
//   <B> Programme des séances à venir. </B> <ul> <li> 24/09/2026. <br><br> Speaker (Affiliation) : <I> Title </I> <br>
//     <font size=2> Abstract : … </font> </li> … </ul>
//   <B> Séances passées. </B> <ul> … same items, newest first … </ul>
// Time and room are applied only to sessions falling on the weekday the page states.

import { CANCEL_RE } from "../../src/shared/text";
import { addDays, nowParis, wall } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, htmlToText, httpGet } from "../util";

const DAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Item { y: number; mo: number; d: number; speaker: string | null; affiliation: string | null; title: string | null; abstract: string | null }

export function parseCergyItems(html: string): Item[] {
  const out: Item[] = [];
  for (const li of html.split(/<li>/i).slice(1)) {
    const body = li.split(/<\/li>/i)[0];
    const dm = body.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*\./);
    if (!dm) continue;
    const head = body.match(/<br>\s*<br>([\s\S]*?)<I>([\s\S]*?)<\/I>/i);
    let speaker: string | null = null, affiliation: string | null = null, title: string | null = null;
    if (head) {
      const who = (htmlToText(head[1]) ?? "").replace(/\s*:\s*$/, "");
      const wm = who.match(/^([\s\S]*?)\s*\(([^()]*)\)\s*$/);
      speaker = cleanWs(wm ? wm[1] : who);
      affiliation = wm ? cleanWs(wm[2]) : null;
      title = htmlToText(head[2]);
    }
    const am = body.match(/<font[^>]*>([\s\S]*?)<\/font>/i);
    const abstract = am ? (htmlToText(am[1]) ?? "").replace(/^(abstract|résumé)\s*:\s*/i, "") || null : null;
    out.push({ y: +dm[3], mo: +dm[2], d: +dm[1], speaker, affiliation, title, abstract });
  }
  return out;
}

export const cergyGeoDyn: Adapter = async (source, params) => {
  const res = emptyResult();
  const f = await httpGet(source.url);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const html = f.text;
  const iUp = html.search(/Programme des s[ée]ances [àa] venir/i);
  const iPast = html.search(/S[ée]ances pass[ée]es/i);
  if (iUp < 0 || iPast < iUp) throw new Error("programme sections not found — layout changed?");

  // Stated slot: "le séminaire se tient tous les jeudis de 11h à 12h, en salle 5.54 du bâtiment E du site de Saint-Martin …"
  const intro = htmlToText(html.slice(0, iUp))?.replace(/\s+/g, " ") ?? "";
  const slot = intro.match(/tous les (\p{L}+?)s? de (\d{1,2})h(\d{2})? [àa] (\d{1,2})h(\d{2})?/iu);
  const weekday = slot ? DAYS[slot[1].toLowerCase()] ?? null : null;
  const room = cleanWs(intro.match(/en (salle \S+(?: du bâtiment \S+)?)/i)?.[1]);
  const yearLabel = intro.match(/ann[ée]e universitaire (\d{4})\s*-\s*(\d{4})/i);
  if (weekday == null) res.warnings.push("weekly slot not found in the introduction — events stored as all-day");

  const now = nowParis();
  const upcoming = parseCergyItems(html.slice(iUp, iPast));
  const past = parseCergyItems(html.slice(iPast)).filter((x) => wall(x.y, x.mo, x.d) >= addDays(now, -14));
  for (const [items, listedPast] of [[upcoming, false], [past, true]] as const) {
    for (const x of items) {
      const day = wall(x.y, x.mo, x.d);
      if (listedPast && day.slice(0, 10) > now.slice(0, 10)) {
        res.warnings.push(`"${x.speaker}" is listed under past sessions with a date of ${day.slice(0, 10)} — skipped (date likely mistyped on the page)`);
        continue;
      }
      const onSlot = slot && weekday === new Date(Date.UTC(x.y, x.mo - 1, x.d)).getUTCDay() ? slot : null;
      const title = x.title ?? "TBA";
      res.events.push({
        external_id: `${day.slice(0, 10)}|${x.speaker}`, title, speaker: x.speaker, speaker_affiliation: x.affiliation, abstract: x.abstract,
        start: onSlot ? wall(x.y, x.mo, x.d, +onSlot[2], +(onSlot[3] ?? 0)) : day,
        end: onSlot ? wall(x.y, x.mo, x.d, +onSlot[4], +(onSlot[5] ?? 0)) : null, all_day: !onSlot,
        room: onSlot ? room : null, location_hint: "cergy", series_id: params.series_id, institution_id: source.institution_id,
        event_type: "seminar", official_url: source.url, source_url: source.url, source_last_modified: f.lastModified,
        status: CANCEL_RE.test(title) ? "cancelled" : null,
      });
    }
  }
  if (slot && weekday != null) {
    res.series.push({
      id: params.series_id, name: "Séminaire de Géométrie et Dynamique de Cergy-Pontoise", institution_id: source.institution_id,
      typical_weekday: DAY_EN[weekday], typical_time: `${slot[2]}:${slot[3] ?? "00"}–${slot[4]}:${slot[5] ?? "00"}`, typical_location: room,
      recurrence: `Weekly, ${DAY_EN[weekday]}s ${slot[2]}h–${slot[4]}h (as stated on the page${yearLabel ? ` for ${yearLabel[1]}–${yearLabel[2]}` : ""})`,
      statement_source: source.url,
    });
  }
  const academicYearStart = +now.slice(5, 7) >= 8 ? +now.slice(0, 4) : +now.slice(0, 4) - 1;
  if (yearLabel && +yearLabel[1] < academicYearStart) {
    res.warnings.push(`slot statement refers to ${yearLabel[1]}–${yearLabel[2]}; page not yet updated for the current academic year`);
  }
  res.complete_window = [now, addDays(now, 60)];
  res.message = `${upcoming.length} upcoming session(s) listed`;
  return res;
};
