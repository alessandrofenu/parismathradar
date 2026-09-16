// Institut de Mathématique d'Orsay — event cards + detail pages.

import * as cheerio from "cheerio";
import { detectEventType } from "../../src/shared/taxonomy";
import { CANCEL_RE, slug } from "../../src/shared/text";
import { addDays, monthFromName, nowParis, wall } from "../../src/shared/time";
import type { RawSeries } from "../models";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, errMessage, htmlToText, httpGet } from "../util";

const BASE = "https://www.imo.universite-paris-saclay.fr";
const TIME_RE = /(\d{1,2})h(\d{2})(?:\s*-\s*(\d{1,2})h(\d{2}))?/;
const TYPE_PREFIX = /^(S[ée]minaire|Conf[ée]rence|Th[èe]se|HDR|Soutenance|Autres?)\s+/i;

async function detail(url: string) {
  const $ = cheerio.load((await httpGet(url)).text);
  const out: { speakers?: string[]; institutions?: string[]; heure?: string; lieu?: string; abstract?: string } = {};
  $(".col_eventdetails-right-pane tr").each((_, tr) => {
    const tds = $(tr).children("td");
    if (tds.length !== 2) return;
    const k = (cleanWs(tds.eq(0).text()) ?? "").replace(/\s*:$/, "").toLowerCase();
    const spans = tds.eq(1).find("span").map((_, s) => cleanWs($(s).text())).get().filter(Boolean) as string[];
    const v = cleanWs(tds.eq(1).text()) ?? "";
    if (k.startsWith("intervenant")) out.speakers = spans.length ? spans : [v];
    else if (k.startsWith("institution")) out.institutions = spans.length ? spans : [v];
    else if (k.startsWith("heure")) out.heure = v;
    else if (k.startsWith("lieu")) out.lieu = v;
  });
  const d = $(".eventdetails_event-description").first();
  if (d.length) {
    const txt = htmlToText(d.html());
    if (txt) out.abstract = txt.replace(/^\s*(abstract|résumé)\s*:?\s*/i, "");
  }
  return out;
}

export const imo: Adapter = async (source, params) => {
  const res = emptyResult();
  const f = await httpGet(source.url);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const $ = cheerio.load(f.text);
  const cards = $(".col_event-bloc").toArray();
  if (!cards.length) throw new Error("no event cards — layout changed?");
  const now = nowParis();
  const series = new Map<string, RawSeries>();
  for (const card of cards) {
    const c = $(card);
    const day = cleanWs(c.find(".event-logo-date-day").first().text());
    const parts = (cleanWs(c.find(".event-logo-date-month-year").first().text()) ?? "").split(/\s+/);
    const link = c.find(".event_event-description a").first();
    if (!day || !link.length || parts.length < 2) continue;
    const month = monthFromName(parts[0]);
    if (!month) {
      res.warnings.push(`unparsed date ${parts.join(" ")}`);
      continue;
    }
    const date = wall(+parts[parts.length - 1], month, +day);
    if (date < addDays(now, -14)) continue;
    const label = cleanWs(c.find(".event_event-title").first().text()) ?? "";
    let title = cleanWs(link.text()) ?? "(untitled)";
    const href = BASE + link.attr("href");
    const ext = (link.attr("href") ?? "").replace(/\/$/, "").split("/").pop()!;
    const speakers = c.find(".event_event-speaker").map((_, s) => cleanWs($(s).text())).get().filter(Boolean) as string[];
    const blockText = speakers.length ? null : cleanWs(c.find(".event_event-speakers").first().text());
    const affs = c.find(".event_event-location").map((_, s) => cleanWs($(s).text())).get().filter(Boolean) as string[];
    const tm = (cleanWs(c.text()) ?? "").match(TIME_RE);
    let start = date, end: string | null = null;
    if (tm) {
      start = `${date.slice(0, 11)}${tm[1].padStart(2, "0")}:${tm[2]}:00`;
      if (tm[3]) end = `${date.slice(0, 11)}${tm[3].padStart(2, "0")}:${tm[4]}:00`;
    }
    const kindWord = (label.match(TYPE_PREFIX)?.[1] ?? "").toLowerCase();
    let etype = ({ thèse: "thesis_defense", these: "thesis_defense", hdr: "thesis_defense", conférence: "conference", conference: "conference" } as Record<string, string>)[kindWord]
      ?? detectEventType(title, label) ?? "seminar";
    if (etype === "conference" && /colloqui/i.test(title)) etype = "colloquium";
    const sid = label && etype === "seminar" ? `imo-${slug(label)}` : null;
    if (sid && !series.has(sid)) {
      series.set(sid, { id: sid, name: `${label} (Orsay)`, institution_id: "lmo", official_url: source.url, location_id: "orsay", kind: "seminar", level: "research" });
    }
    let det: Awaited<ReturnType<typeof detail>> = {};
    if (date <= addDays(now, Number(params.detail_days ?? 21))) {
      try {
        det = await detail(href);
      } catch (e) {
        res.warnings.push(`detail ${ext}: ${errMessage(e)}`);
      }
    }
    const tm2 = det.heure?.match(TIME_RE);
    if (tm2) {
      start = `${date.slice(0, 11)}${tm2[1].padStart(2, "0")}:${tm2[2]}:00`;
      if (tm2[3]) end = `${date.slice(0, 11)}${tm2[3].padStart(2, "0")}:${tm2[4]}:00`;
    }
    let speaker = (det.speakers ?? speakers).filter(Boolean).join(", ") || null;
    let aff = (det.institutions ?? affs).filter(Boolean).join(", ") || null;
    if (etype === "thesis_defense") {
      // thesis cards: the link text is the candidate, the speaker block is the thesis title
      const candidate = title;
      title = blockText || speakers.join(", ") || `Thesis defence — ${candidate}`;
      speaker = candidate;
      aff = null;
    }
    res.events.push({
      external_id: ext, title, start, end, all_day: !tm, speaker, speaker_affiliation: aff, abstract: det.abstract ?? null,
      location_text: det.lieu ? `IMO Orsay, ${det.lieu}` : null, room: det.lieu ?? null, location_hint: "orsay", series_id: sid,
      series_name: label || null, department: label || null, institution_id: "lmo", event_type: etype, official_url: href,
      source_url: source.url, status: CANCEL_RE.test(title) ? "cancelled" : null,
    });
  }
  res.series = [...series.values()];
  res.complete_window = [now, addDays(now, 60)];
  return res;
};
