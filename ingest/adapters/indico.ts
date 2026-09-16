// Indico (indico.math.cnrs.fr) — HTTP export API, one Paris-region sub-category per source.

import { detectEventType } from "../../src/shared/taxonomy";
import { CANCEL_RE } from "../../src/shared/text";
import { addDays, minutesBetween, nowParis, zonedToParis } from "../../src/shared/time";
import type { RawSeries } from "../models";
import { emptyResult, type Adapter } from "../models";
import { cleanWs, htmlToText, httpGet } from "../util";

const BASE = "https://indico.math.cnrs.fr";
const ADMIN_CATEGORY = /gestion|call for proposals|appel [àa] projets|test\b|admin|recensement|mathrice/i;
const ADMIN_TITLE = /\b(admin|financial support|registration form|page de recensement)\b/i;

const dt = (o: any): string | null => (o?.date ? zonedToParis(`${o.date}T${String(o.time ?? "00:00:00").slice(0, 8)}`, o.tz) : null);
const lastFirst = (s: string) => s.replace(/^([\p{L}][\p{L}\p{M}' .-]*), ([\p{L}][\p{L}\p{M}' .-]*)$/u, "$2 $1");

export const indico: Adapter = async (source, params) => {
  const res = emptyResult();
  const cat = params.category;
  const f = await httpGet(`${BASE}/export/categ/${cat}.json`, { params: { from: "-14d", to: "365d", detail: "events" } });
  if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
  const data = JSON.parse(f.text);
  const now = nowParis();
  const discovered = new Map<string, RawSeries>();
  for (const e of data.results ?? []) {
    const category = cleanWs(e.category) ?? "";
    const title = cleanWs(e.title) ?? "(untitled)";
    if (ADMIN_CATEGORY.test(category) || ADMIN_TITLE.test(title)) continue;
    if (e.visibility?.name === "Nowhere") continue;
    const start = dt(e.startDate), end = dt(e.endDate);
    if (!start) continue;
    const allDay = !!end && minutesBetween(start, end) >= 20 * 60;
    const chairs: any[] = (e.chairs ?? []).filter((c: any) => c.fullName);
    const speaker = chairs.map((c) => lastFirst(cleanWs(c.fullName) ?? "")).filter(Boolean).join(", ") || null;
    const aff = chairs.length === 1 ? cleanWs(chairs[0].affiliation) : null;
    const isSeriesCat = !!category && !/^(région parisienne|i\.h\.e\.s|institut henri poincar)/i.test(category);
    const sid = isSeriesCat ? `indico-cat-${e.categoryId}` : null;
    if (sid && !discovered.has(sid)) {
      discovered.set(sid, {
        id: sid, name: category, institution_id: source.institution_id, official_url: `${BASE}/category/${e.categoryId}/`,
        calendar_url: `${BASE}/category/${e.categoryId}/events.ics`, kind: detectEventType(category) ?? "seminar", level: "research", has_archive: true,
      });
    }
    const room = cleanWs(e.roomFullname || e.room);
    const loc = [room, cleanWs(e.location)].filter(Boolean).join(", ") || null;
    const address = cleanWs(e.address);
    const etype = detectEventType(e.type !== "lecture" ? title : null, category) ?? (e.type === "conference" ? "conference" : "seminar");
    const description = htmlToText(e.description);
    res.events.push({
      external_id: String(e.id), title, start, end, all_day: allDay, speaker, speaker_affiliation: aff,
      abstract: description ? description.split(/\n\s*={4,}/)[0].trim() || null : null,
      location_text: [loc, address].filter(Boolean).join(", ") || null, room, building: cleanWs(e.location), series_id: sid,
      series_name: category || null, institution_id: source.institution_id, event_type: etype, official_url: e.url ?? null,
      source_url: `${BASE}/category/${cat}/`, organizer: cleanWs(e.organizer), status: CANCEL_RE.test(title) ? "cancelled" : null,
    });
  }
  res.series = [...discovered.values()];
  res.complete_window = [now, addDays(now, 365)];
  return res;
};
