// IHES events page: three tabs (seminars, cours, conferences) rendered as tables linking to Indico.

import * as cheerio from "cheerio";
import { CANCEL_RE, slug } from "../../src/shared/text";
import { addDays, monthFromName, nowParis, wall } from "../../src/shared/time";
import type { RawSeries } from "../models";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, httpGet } from "../util";

const DATE_RE = /(\d{1,2})\s+([A-Za-zéû]+)\s+(\d{4})(?:\s*from\s*(\d{1,2}):(\d{2})\s*to\s*(\d{1,2}):(\d{2}))?/i;
const RANGE_RE = /from\s+(?:[A-Za-z]+\s+)?(\d{1,2})(?:\s+([A-Za-z]+))?(?:\s+(\d{4}))?\s+to\s+(?:[A-Za-z]+\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i;
const KIND: Record<string, string> = { seminars: "seminar", cours: "course", conferences: "conference" };

export const ihes: Adapter = async (source) => {
  const res = emptyResult();
  const f = await httpGet(source.url);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const $ = cheerio.load(f.text);
  const now = nowParis();
  const series = new Map<string, RawSeries>();
  const panels = $("div.Panel");
  if (!panels.length) throw new Error("no event panels found — layout changed?");
  panels.each((_, panel) => {
    const kind = KIND[$(panel).attr("id") ?? ""] ?? "seminar";
    $(panel).find("table").each((_, table) => {
      if (/past|pass/i.test($(table).prevAll("h2").first().text())) return;
      $(table).find("tbody tr").each((_, tr) => {
        const dcell = $(tr).find(".Agenda-date"), scell = $(tr).find(".Agenda-sujet");
        if (!dcell.length || !scell.length) return;
        const dtText = cleanWs(dcell.text()) ?? "";
        const a = scell.find("h3 a").first();
        const link = a.attr("href") ?? null;
        const ext = link?.match(/\/event\/(\d+)/)?.[1];
        const title = cleanWs(a.length ? a.text() : scell.text()) ?? "(untitled)";

        const rm = /^from/i.test(dtText) ? dtText.match(RANGE_RE) : null;
        if (rm && monthFromName(rm[5])) {
          const y2 = +rm[6], mo2 = monthFromName(rm[5])!, d2 = +rm[4];
          let mo1 = (rm[2] && monthFromName(rm[2])) || mo2;
          let y1 = rm[3] ? +rm[3] : y2;
          const d1 = +rm[1];
          if (!rm[2] && d1 > d2) [mo1, y1] = mo2 > 1 ? [mo2 - 1, y2] : [12, y2 - 1]; // "from Monday 31 to Friday 04 June" → 31 May
          const start = wall(y1, mo1, d1), end = wall(y2, mo2, d2, 23, 59);
          if (end < now) return;
          res.events.push({ external_id: ext ?? `${start}|${title}`, title, start, end, all_day: true, institution_id: "ihes",
            event_type: kind, official_url: link, source_url: source.url, location_hint: "ihes", location_text: "IHES, Bures-sur-Yvette" });
          return;
        }
        const m = dtText.match(DATE_RE);
        const mon = m ? monthFromName(m[2]) : null;
        if (!m || !mon) {
          res.warnings.push(`unparsed date ${JSON.stringify(dtText)}`);
          return;
        }
        const start = wall(+m[3], mon, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
        const end = m[6] ? wall(+m[3], mon, +m[1], +m[6], +m[7]) : null;
        if (start < addDays(now, -14)) return;
        const seriesName = cleanWs(scell.find("small").first().text());
        const speaker = cleanWs(scell.find("strong").first().text());
        const sid = seriesName ? `ihes-${slug(seriesName)}` : null;
        if (sid && !series.has(sid)) {
          series.set(sid, { id: sid, name: seriesName!, institution_id: "ihes", official_url: source.url, location_id: "ihes", kind, level: "research" });
        }
        res.events.push({
          external_id: ext ?? `${start}|${title}`, title, start, end, all_day: !m[4], speaker, series_id: sid, series_name: seriesName,
          institution_id: "ihes", event_type: kind, official_url: link, source_url: source.url, location_hint: "ihes",
          location_text: "IHES, Bures-sur-Yvette", status: CANCEL_RE.test(title) ? "cancelled" : null,
        });
      });
    });
  });
  res.series = [...series.values()];
  res.complete_window = [now, addDays(now, 60)];
  return res;
};
