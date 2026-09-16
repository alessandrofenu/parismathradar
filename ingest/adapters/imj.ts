// IMJ-PRG event-management system (https://www.imj-prg.fr/gestion/evenement).
// 1. The index lists every series with team codes and organisers.
// 2. Each series page (affEvenement/<id>) has a header (teams, organisers, room, address, description) and a
//    "Séances à suivre" table; each row is followed by a hidden collapse row holding the abstract.
// 3. For talks in the next DETAIL_DAYS days the talk page (affSeance/<id>) gives affiliation and end time.

import * as cheerio from "cheerio";
import { detectEventType } from "../../src/shared/taxonomy";
import { CANCEL_RE, NO_SESSION_RE, isPlaceholder } from "../../src/shared/text";
import { addDays, nowParis, wall } from "../../src/shared/time";
import { IMJ_TEAMS } from "../catalogue";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, errMessage, htmlToText, httpGet } from "../util";

const BASE = "https://www.imj-prg.fr";
const DETAIL_DAYS = 35;
const WEEKDAYS_FR: Record<string, string> = { lundi: "Monday", mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday", vendredi: "Friday" };

interface IndexRow { num: string; name: string; teams: string[]; organizers: string | null; section: string | null }
interface Session {
  seance: string; speaker: string | null; title: string | null; date: string | null; time: string | null;
  room: string | null; address: string | null; online: string | null; abstract: string | null;
}

function parseIndex(html: string): IndexRow[] {
  const $ = cheerio.load(html);
  const out: IndexRow[] = [];
  $("table.tabsem").each((_, table) => {
    const section = cleanWs($(table).prevAll("h2").first().text());
    $(table).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      const a = $(tr).find("a[href*='affEvenement/']").first();
      const num = a.attr("href")?.match(/affEvenement\/(\d+)/)?.[1];
      if (!num || tds.length < 3) return;
      out.push({
        num, name: cleanWs(a.text()) ?? `Series ${num}`, teams: (cleanWs(tds.eq(1).text()) ?? "").split(/\s+/).filter(Boolean),
        organizers: cleanWs(tds.eq(2).text()), section,
      });
    });
  });
  return out;
}

function parseSeriesPage(html: string) {
  const $ = cheerio.load(html);
  const head: Record<string, string | null> = {};
  const t = $("table.tabsem").first();
  if (t.length) {
    const tds = t.find("td");
    if (tds.length >= 4) {
      head.teams_text = cleanWs(tds.eq(0).text());
      head.organizers = cleanWs(tds.eq(1).text());
      head.room = cleanWs(tds.eq(2).text());
      head.address = cleanWs(tds.eq(3).text());
    }
    const well = t.parent("div").nextAll("div.well").first();
    if (well.length && !well.find("h2").length) head.description = htmlToText(well.html());
  }
  const sessions: Session[] = [];
  const h2 = $("h2").filter((_, e) => $(e).text().includes("Séances à suivre")).first();
  if (h2.length) {
    const table = h2.nextAll("table").first();
    table.find("tr[data-target]").each((_, tr) => {
      const tds = $(tr).children("td");
      const a = $(tr).find("a[href*='affSeance/']").first();
      const seance = a.attr("href")?.match(/affSeance\/(\d+)/)?.[1];
      if (!seance || tds.length < 8) return;
      let abstract: string | null = null;
      const nxt = $(tr).next("tr");
      if (nxt.length && nxt.hasClass("collapse")) abstract = htmlToText(nxt.children("td").first().html());
      sessions.push({
        seance, speaker: cleanWs(tds.eq(2).text()), title: cleanWs(a.text()), date: cleanWs(tds.eq(4).text()),
        time: cleanWs(tds.eq(5).text()), room: cleanWs(tds.eq(6).text()), address: cleanWs(tds.eq(7).text()),
        online: tds.eq(8).find("a").first().attr("href") || null, abstract,
      });
    });
  }
  return { head, sessions };
}

function parseSeance(html: string) {
  const $ = cheerio.load(html);
  const out: Record<string, string | null> = {};
  $("tr").each((_, tr) => {
    const tds = $(tr).children("td");
    if (tds.length !== 2) return;
    const k = (cleanWs(tds.eq(0).text()) ?? "").replace(/\s*:$/, "");
    const v = cleanWs(tds.eq(1).text());
    if (k === "Orateur(s)" && v) out.speaker_line = v;
    else if (k === "Horaire" && v) out.horaire = v;
    else if (k.startsWith("Résum") && v) out.abstract = htmlToText(tds.eq(1).html());
  });
  return out;
}

function splitSpeakerLine(line: string): [string | null, string | null] {
  // "Benjamin Audoux - I2M (Marseille)," ; "Luke Conners - ,"
  const l = line.trim().replace(/,$/, "").trim();
  const m = l.match(/^(.*?)\s+-\s*(.*)$/);
  if (!m) return [l || null, null];
  return [m[1].trim() || null, m[2].trim().replace(/,$/, "").trim() || null];
}

export const imj: Adapter = async () => {
  const res = emptyResult();
  const idx = await httpGet(`${BASE}/gestion/evenement`);
  if (idx.status !== 200) throw new Error(`index HTTP ${idx.status}`);
  const seriesList = parseIndex(idx.text);
  if (seriesList.length < 20) throw new Error(`index parsing returned only ${seriesList.length} series — page layout changed?`);
  const now = nowParis();
  const horizon = addDays(now, 400);
  let failures = 0;

  for (const s of seriesList) {
    const sid = `imj-${s.num}`;
    const url = `${BASE}/gestion/evenement/affEvenement/${s.num}`;
    let page;
    try {
      page = await httpGet(url);
    } catch (e) {
      failures++;
      res.warnings.push(`${s.name}: ${errMessage(e)}`);
      continue;
    }
    if (page.status !== 200) {
      failures++;
      res.warnings.push(`${s.name}: HTTP ${page.status}`);
      continue;
    }
    const { head, sessions } = parseSeriesPage(page.text);
    const topics: string[] = [];
    const teamLabels: string[] = [];
    for (const code of s.teams) {
      const team = IMJ_TEAMS[code];
      if (!team) continue;
      teamLabels.push(team[0]);
      for (const t of team[1]) if (!topics.includes(t)) topics.push(t);
    }
    const kind = detectEventType(s.name) ?? (/groupe/i.test(s.section ?? "") ? "working_group" : "seminar");
    const desc = head.description ?? null;
    let weekday: string | null = null, time: string | null = null;
    const wm = desc?.match(/\b(le|les)\s+(lundi|mardi|mercredi|jeudi|vendredi)s?\b[^.]{0,40}?\b(\d{1,2})\s*h\s*(\d{2})?/i);
    if (wm) { // only record a regular slot when the page states it explicitly
      weekday = WEEKDAYS_FR[wm[2].toLowerCase()];
      time = `${wm[3].padStart(2, "0")}:${wm[4] ?? "00"}`;
    }
    const future: [string, Session][] = [];
    for (const x of sessions) {
      const dm = x.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const tm = (x.time ?? "00:00").match(/^(\d{1,2}):(\d{2})$/);
      if (!dm || !tm) {
        res.warnings.push(`${s.name}: unparseable date ${x.date} ${x.time}`);
        continue;
      }
      const d = wall(+dm[3], +dm[2], +dm[1], +tm[1], +tm[2]);
      if (d < addDays(now, -14) || d > horizon) continue;
      future.push([d, x]);
    }
    res.series.push({
      id: sid, name: s.name, institution_id: "imj-prg", department: teamLabels.join("; ") || head.teams_text,
      organizers: s.organizers ?? head.organizers, official_url: url,
      typical_location: [head.address, head.room].filter(Boolean).join(", ") || null, typical_weekday: weekday, typical_time: time,
      recurrence: weekday ? `${weekday}s ${time} (stated in the series description)` : null, statement_source: weekday ? url : null,
      published_in_advance: future.length >= 3 ? "yes" : null, has_archive: true, kind, level: "research", topics, description: desc,
    });

    for (const [d, x] of future) {
      let title = x.title ?? "";
      let speaker = x.speaker;
      let status: "cancelled" | "tba" | "no_session" | null = null;
      if (NO_SESSION_RE.test(title)) status = "no_session";
      else if (CANCEL_RE.test(title)) status = "cancelled";
      else if (isPlaceholder(title) && !speaker) status = "tba";
      let end: string | null = null, aff: string | null = null;
      let abstract = x.abstract;
      const seanceUrl = `${BASE}/gestion/evenement/affSeance/${x.seance}`;
      if (status === null && d <= addDays(now, DETAIL_DAYS)) {
        try {
          const det = parseSeance((await httpGet(seanceUrl)).text);
          if (det.speaker_line) {
            const [name, a] = splitSpeakerLine(det.speaker_line);
            speaker = speaker ?? name;
            aff = a;
          }
          const hm = det.horaire?.match(/(\d{1,2}):(\d{2})\s*à\s*(\d{1,2}):(\d{2})/);
          if (hm) {
            const e = `${d.slice(0, 11)}${hm[3].padStart(2, "0")}:${hm[4]}:00`;
            end = e > d ? e : null;
          }
          abstract = abstract ?? det.abstract ?? null;
        } catch (e) {
          res.warnings.push(`talk ${x.seance}: ${errMessage(e)}`);
        }
      }
      if (title.startsWith("TBA (") && speaker) title = "TBA";
      res.events.push({
        external_id: x.seance, title: title || "TBA", start: d, end, speaker, speaker_affiliation: aff,
        abstract: abstract && abstract.length > 3 ? abstract : null, location_text: [x.address, x.room].filter(Boolean).join(", ") || null,
        room: x.room, building: x.address, series_id: sid, series_name: s.name, department: teamLabels.join("; ") || null,
        institution_id: "imj-prg", event_type: kind, official_url: seanceUrl, source_url: url, online_url: x.online,
        organizer: s.organizers, status,
      });
    }
  }
  if (failures > seriesList.length / 3) throw new Error(`${failures} of ${seriesList.length} series pages failed`);
  res.complete_window = [now, addDays(now, 120)];
  res.message = `${seriesList.length} series crawled`;
  return res;
};
