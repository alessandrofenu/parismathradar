// LAGA (Université Sorbonne Paris Nord) team seminar pages.
// The ICS/RSS exports linked on these pages stopped being regenerated in June 2023, so we read the HTML list:
//   <dt>Jeudi 8 janvier 2026 … <dd><i><b>14:00&nbsp;&nbsp;&nbsp;[<a href=homepage>]Speaker[</a>]</b></i>(Affiliation)
//   [<a …>Résumé</a>]<br>Title<br>Location<div id="display_rN" style="display:none">Abstract</div><p>
// GET shows upcoming talks; POST annee=<year> shows the whole year.

import { CANCEL_RE } from "../../src/shared/text";
import { addDays, monthFromName, nowParis, wall } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, errMessage, htmlToText, httpGet } from "../util";

const AFTERNOON_RE = /apr[eè]s-midi.{0,20}topolog/i;

interface Item { start: string; speaker: string | null; speaker_url: string | null; affiliation: string | null; title: string | null; location: string | null; abstract: string | null }

export function parseLagaPage(html: string): Item[] {
  const i = html.indexOf('class="entry clr"');
  const j = html.indexOf("</article>", i);
  const seg = i > 0 && j > i ? html.slice(i, j) : html;
  const out: Item[] = [];
  for (const block of seg.split("<dt>").slice(1)) {
    const dm = (htmlToText(block.split("<dd>")[0]) ?? "").match(/(\d{1,2})\s+([A-Za-zéûÉÛ]+)\s+(\d{4})/);
    const month = dm ? monthFromName(dm[2]) : null;
    if (!dm || !month) continue;
    for (const chunk of block.split("<dd>").slice(1)) {
      const m = chunk.match(/<i><b>([\s\S]*?)<\/b><\/i>\s*\(([^)]*)\)/);
      if (!m) continue;
      const head = htmlToText(m[1]) ?? "";
      const hm = head.match(/^(\d{1,2}):(\d{2})\s+([\s\S]*)$/);
      if (!hm) continue;
      const url = m[1].match(/href=['"]([^'"]+)['"]/);
      const rest = chunk.slice((m.index ?? 0) + m[0].length);
      const am = rest.match(/<div id="display_r\d+" style="display:none">([\s\S]*)$/);
      let abstract: string | null = null;
      let before = rest;
      if (am) {
        abstract = htmlToText(am[1].trim().replace(/<\/div>\s*(<p>)?\s*$/, ""));
        before = rest.slice(0, am.index);
      }
      before = before.replace(/<a href="#"[\s\S]*?<\/a>/g, "");
      const parts = before.split(/<br\s*\/?>/).map((p) => htmlToText(p)).filter((p): p is string => !!p);
      out.push({
        start: wall(+dm[3], month, +dm[1], +hm[1], +hm[2]), speaker: cleanWs(hm[3]), speaker_url: url?.[1] ?? null,
        affiliation: cleanWs(m[2]), title: parts[0] ?? null, location: parts[1] ?? null, abstract,
      });
    }
  }
  return out;
}

export const laga: Adapter = async (_source, params) => {
  const res = emptyResult();
  const page: string = params.page;
  const now = nowParis();
  const f = await httpGet(page);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  if (!f.text.includes('name="annee"')) throw new Error("seminar form not found — layout changed?");
  const items = parseLagaPage(f.text);
  const seen = new Set(items.map((x) => `${x.start}|${x.speaker}`));
  try {
    const r = await httpGet(page, { method: "POST", form: { annee: now.slice(0, 4) } });
    for (const x of parseLagaPage(r.text)) {
      if (!seen.has(`${x.start}|${x.speaker}`) && x.start >= addDays(now, -14)) items.push(x);
    }
  } catch (e) {
    res.warnings.push(`year listing failed: ${errMessage(e)}`);
  }
  for (const x of items) {
    if (x.start < addDays(now, -14)) continue;
    const title = x.title ?? "TBA";
    const afternoon = AFTERNOON_RE.test(title);
    res.events.push({
      external_id: `${x.start}|${x.speaker}`, title, start: x.start, speaker: x.speaker, speaker_affiliation: x.affiliation,
      speaker_url: x.speaker_url, abstract: x.abstract, location_text: x.location, location_hint: x.location ? null : "villetaneuse",
      series_id: afternoon ? "paris-apres-midi-topologie" : params.series_id, series_name: afternoon ? title : null, institution_id: "laga",
      event_type: afternoon ? "conference" : "seminar", official_url: page, source_url: page, status: CANCEL_RE.test(title) ? "cancelled" : null,
    });
  }
  res.complete_window = [now, addDays(now, 90)];
  return res;
};
