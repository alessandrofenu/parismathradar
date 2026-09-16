// ENS DMA — WordPress "The Events Calendar" REST API.

import * as cheerio from "cheerio";
import { detectEventType } from "../../src/shared/taxonomy";
import { CANCEL_RE, slug } from "../../src/shared/text";
import { addDays, nowParis } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, decodeEntities, htmlToText, httpGet } from "../util";

const API = "https://www.math.ens.psl.eu/wp-json/tribe/events/v1/events";
const NON_SERIES = /^(ann[ée]e \d{4}|prochaine s[ée]ance|s[ée]ances suivantes)/i;

function abstractOf(descHtml: string | null | undefined): string | null {
  if (!descHtml) return null;
  const $ = cheerio.load(`<div id="__r">${descHtml}</div>`);
  $(".tribe-events-schedule, .tribe-events-single-section, .tribe-events-event-meta").remove();
  return htmlToText($("#__r").html());
}

const toWall = (s: string) => s.replace(" ", "T");

export const ens: Adapter = async (source) => {
  const res = emptyResult();
  const now = nowParis();
  const events: any[] = [];
  for (let page = 1; ; page++) {
    const f = await httpGet(API, { params: { start_date: addDays(now, -14).slice(0, 10), per_page: 50, page } });
    if (f.status === 404 && page > 1) break;
    if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
    const data = JSON.parse(f.text);
    events.push(...(data.events ?? []));
    if (page >= Number(data.total_pages ?? 1)) break;
  }
  const seenSeries = new Map<string, string>();
  for (const e of events) {
    const cats: string[] = (e.categories ?? []).map((c: any) => decodeEntities(c.name));
    const seriesName = cats.find((c) => !NON_SERIES.test(c)) ?? null;
    const sid = seriesName ? `ens-${slug(seriesName)}` : null;
    if (sid && seriesName) seenSeries.set(sid, seriesName);
    const rawTitle = cleanWs(decodeEntities(e.title)) ?? "";
    const status = CANCEL_RE.test(rawTitle.split("–")[0]) ? "cancelled" : null;
    const t = rawTitle.replace(/^(CANCELED|CANCELLED|ANNUL[ÉE]E?)\s*[–-]\s*/i, "");
    let speaker: string | null = null, aff: string | null = null, title = t;
    const m = t.match(/^(.+?)\s+[–-]\s+(.+)$/);
    if (m) {
      speaker = m[1].trim();
      title = m[2].trim();
    } else {
      const m2 = t.match(/^([^()]+?)\s*\(([^()]+)\)?\s*$/);
      if (m2 && t.length < 90) {
        speaker = m2[1].trim();
        aff = m2[2].trim();
        title = "Title not yet announced";
      } else if (t.split(/\s+/).length <= 4 && seriesName?.includes("minaire")) {
        speaker = t;
        title = "Title not yet announced";
      }
    }
    if (speaker) {
      const m3 = speaker.match(/^([^()]+?)\s*\(([^()]+)\)$/);
      if (m3) {
        speaker = m3[1].trim();
        aff = m3[2].trim();
      }
    }
    const venue: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(e.venue ?? {})) venue[k] = typeof v === "string" ? cleanWs(v) : null;
    const vtext = [venue.venue, venue.address, venue.city].filter(Boolean).join(", ") || null;
    let etype = detectEventType(seriesName, rawTitle) ?? "seminar";
    if (speaker && (etype === "conference" || etype === "workshop") && seriesName?.includes("minaire")) etype = "seminar";
    res.events.push({
      external_id: String(e.id), title, start: toWall(e.start_date), end: e.end_date ? toWall(e.end_date) : null, all_day: !!e.all_day,
      speaker, speaker_affiliation: aff, abstract: abstractOf(e.description), location_text: vtext, room: venue.venue ?? null,
      series_id: sid, series_name: seriesName, institution_id: "ens-dma", event_type: etype, official_url: e.url ?? null,
      source_url: source.url, organizer: (e.organizer ?? []).map((o: any) => o.organizer).filter(Boolean).join(", ") || null,
      status, source_last_modified: e.modified ?? null,
    });
  }
  for (const [id, name] of seenSeries) {
    res.series.push({ id, name, institution_id: "ens-dma", official_url: source.url, kind: detectEventType(name) ?? "seminar", level: "research" });
  }
  res.complete_window = [now, addDays(now, 365)];
  return res;
};
