// M2 « Mathématiques fondamentales » (Sorbonne Université / Université Paris Cité / USPN): student working groups.
// https://master-math-fonda.imj-prg.fr/gt.html lists each group as a link to a one-page PDF presentation:
//   <h2>Liste des groupes de travail organisés</h2> <ul> <li><a href="gt/dag.pdf">Géométrie dérivée</a></li> … </ul>
//   <h2>Liste des sujets proposés</h2> <ul> … </ul>
// Sessions are arranged among the students (rooms "suivant les informations reçues par email") and are not published
// with dates, so this adapter only discovers series; it never produces events. The PDFs' Last-Modified dates tell
// which academic year the list belongs to.

import { topicsFromSeriesName } from "../../src/shared/taxonomy";
import { instantToParis, nowParis } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { errMessage, htmlToText, httpGet } from "../util";

const academicYear = (parisIso: string): number => (+parisIso.slice(5, 7) >= 8 ? +parisIso.slice(0, 4) : +parisIso.slice(0, 4) - 1);

export const m2fonda: Adapter = async (source) => {
  const res = emptyResult();
  const f = await httpGet(source.url);
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const sections = f.text.split(/<h2>/i).slice(1);
  if (!sections.length) throw new Error("no <h2> sections — layout changed?");
  let newest: string | null = null;
  for (const sec of sections) {
    const heading = htmlToText(sec.split(/<\/h2>/i)[0]) ?? "";
    const proposed = /propos/i.test(heading);
    if (!proposed && !/organis/i.test(heading)) continue;
    for (const m of sec.matchAll(/<li>\s*<a href="([^"]+\.pdf)">([\s\S]*?)<\/a>/gi)) {
      const url = new URL(m[1], source.url).toString();
      const name = htmlToText(m[2])?.replace(/\s+/g, " ") ?? m[1];
      const key = m[1].split("/").pop()!.replace(/\.pdf$/i, "");
      let modified: string | null = null;
      try {
        const p = await httpGet(url);
        if (p.status !== 200) res.warnings.push(`${key}.pdf: HTTP ${p.status}`);
        else if (p.lastModified) modified = instantToParis(Date.parse(p.lastModified)).slice(0, 10);
      } catch (e) {
        res.warnings.push(`${key}.pdf: ${errMessage(e)}`);
      }
      if (modified && (!newest || modified > newest)) newest = modified;
      const year = modified ? academicYear(modified) : null;
      res.series.push({
        id: `m2fonda-gt-${key.toLowerCase()}`, name: proposed ? `Sujet proposé — ${name}` : `GT M2 — ${name}`, institution_id: source.institution_id,
        department: "M2 Mathématiques fondamentales", official_url: url, kind: "working_group", level: "master", has_archive: false,
        published_in_advance: "no", topics: topicsFromSeriesName(name),
        description: `${proposed ? "Topic proposed for a working group (not yet organised)" : "Student working group of the M2"}`
          + `${year ? `, ${year}–${year + 1} (presentation PDF updated ${modified})` : ""}. Sessions are arranged among the participants and not published with dates.`,
        statement_source: source.url,
      });
    }
  }
  if (!res.series.length) throw new Error("no working groups parsed — layout changed?");
  const stale = newest && academicYear(newest) < academicYear(nowParis());
  res.status_override = stale ? "stale" : "manual";
  res.message = `${res.series.length} working groups/topics listed; newest presentation PDF ${newest ?? "undated"}`
    + (stale ? " — the list has not been renewed for the current academic year yet." : ". Session dates are not published: ask the contacts in each PDF.");
  return res;
};
