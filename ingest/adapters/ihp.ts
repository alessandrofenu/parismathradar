// Institut Henri Poincaré: paginated agenda + recurring-seminar catalogue page.

import * as cheerio from "cheerio";
import { detectEventType, topicsFromSeriesName } from "../../src/shared/taxonomy";
import { CANCEL_RE, slug } from "../../src/shared/text";
import { addDays, nowParis } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, httpGet } from "../util";

const BASE = "https://www.ihp.fr";

export const ihp: Adapter = async (_source, params) => {
  const res = emptyResult();
  const now = nowParis();
  let total = 0;
  for (let page = 0; page < Number(params.pages ?? 6); page++) {
    const f = await httpGet(`${BASE}/fr/agenda`, { params: page ? { page } : {} });
    if (f.status !== 200) throw new Error(`page ${page}: HTTP ${f.status}`);
    const $ = cheerio.load(f.text);
    const items = $("article.event-item");
    if (!items.length) break;
    items.each((_, art) => {
      const dates = $(art).find(".event-item__date time.date__time").map((_, t) => $(t).attr("datetime")).get();
      const a = $(art).find(".event-item__title a").first();
      if (!dates.length || !a.length) return;
      const times = $(art).find(".is-time time").map((_, t) => $(t).attr("datetime")).get();
      const title = cleanWs(a.text()) ?? "(untitled)";
      const href = a.attr("href") ?? "";
      const category = cleanWs($(art).find(".event-item__category").first().text());
      const placeEl = $(art).find(".is-place").first();
      let place: string | null = null;
      if (placeEl.length) {
        placeEl.find(".ghost, span[aria-hidden]").remove();
        placeEl.find("br").replaceWith(", ");
        place = (cleanWs(placeEl.text()) ?? "").replace(/(\s*,\s*)+/g, ", ").replace(/^, |, $/g, "") || null;
      }
      const d0 = dates[0], d1 = dates[dates.length - 1];
      let start = `${d0}T00:00:00`, end: string | null = `${d1}T00:00:00`;
      if (times.length) {
        start = `${d0}T${times[0]}:00`;
        end = times.length > 1 ? `${d1}T${times[1]}:00` : null;
      }
      if ((end ?? start) < addDays(now, -1)) return;
      total++;
      const etype = detectEventType(category, title) ?? (d1 > d0 ? "conference" : "seminar");
      const generic = !category || /conf[ée]rences?|programme|centre [ée]mile borel|colloque|atelier|exposition|autres|mus[ée]e/i.test(category);
      const sid = generic ? null : `ihp-${slug(category!)}`;
      if (sid) {
        res.series.push({ id: sid, name: category!, institution_id: "ihp", official_url: `${BASE}/fr/seminaires-recurrents-et-groupes-de-travail`,
          kind: detectEventType(category) ?? "seminar", level: "research" });
      }
      res.events.push({
        external_id: href, title, start, end, all_day: !times.length, location_text: place, series_id: sid, series_name: category,
        institution_id: "ihp", event_type: etype, official_url: href.startsWith("/") ? BASE + href : href, source_url: `${BASE}/fr/agenda`,
        status: CANCEL_RE.test(title) ? "cancelled" : null,
      });
    });
  }
  if (!total) res.warnings.push("No upcoming items parsed from the IHP agenda.");
  return res;
};

const FREQ: Record<string, string> = {
  hebdomadaire: "Weekly", "bi-mensuel": "Twice a month", mensuel: "Monthly", bimestriel: "Every two months", trimestriel: "Quarterly",
  semestriel: "Twice a year",
};
const DAYS: Record<string, string> = {
  lundi: "Monday", mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday", vendredi: "Friday", samedi: "Saturday", dimanche: "Sunday",
};

/** Series discovery. Records frequency/weekday exactly as printed on the IHP page. */
export const ihpRecurrent: Adapter = async (source) => {
  const res = emptyResult();
  const f = await httpGet(source.url);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const i = f.text.indexOf("Accès rapides"), j = f.text.indexOf("Newsletter");
  let seg = i > 0 && j > i ? f.text.slice(i, j) : f.text;
  seg = seg.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, u, n) => ` §§${u}§§${String(n).replace(/<[^>]+>/g, "")}§§ `);
  const lines = (cleanWs(seg.replace(/<[^>]+>/g, " \n ")) ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  let freq: string | null = null;
  let pending: { url: string; name: string } | null = null;
  const flush = (weekday: string | null) => {
    if (pending && freq && !/^(consulter|accéder)/i.test(pending.name)) {
      const url = pending.url.startsWith("/") ? BASE + pending.url : pending.url;
      res.series.push({
        id: `ihp-${slug(pending.name)}`, name: pending.name, institution_id: "ihp", official_url: url, location_id: "ihp",
        typical_location: "Institut Henri Poincaré", typical_weekday: weekday,
        recurrence: `${freq}${weekday ? `, ${weekday}s` : ""} (as listed by IHP)`, statement_source: source.url,
        kind: detectEventType(pending.name) ?? "seminar", level: "research", topics: topicsFromSeriesName(pending.name),
      });
    }
    pending = null;
  };
  for (const line of lines) {
    const key = line.toLowerCase();
    if (FREQ[key]) {
      flush(null);
      freq = FREQ[key];
      continue;
    }
    const m = line.match(/§§([^§]+)§§([^§]+)§§\s*-?\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?/i);
    if (m) {
      flush(null);
      pending = { url: m[1], name: cleanWs(m[2]) ?? m[2] };
      if (m[3]) flush(DAYS[m[3].toLowerCase()]);
      continue;
    }
    if (pending && line === "-") continue;
    if (pending && DAYS[key]) {
      flush(DAYS[key]);
      continue;
    }
    flush(null);
  }
  flush(null);
  if (!res.series.length) throw new Error("no series parsed — layout changed?");
  res.message = `${res.series.length} recurring series listed by IHP`;
  return res;
};
