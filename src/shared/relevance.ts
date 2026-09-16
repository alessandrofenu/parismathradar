// Personal relevance score (0–100) with human-readable, metadata-based reasons. Runs in the browser.

import { TOPIC_BY_ID } from "./taxonomy";
import type { EventData, Prefs, Tier } from "./types";

const STRENGTH: Record<string, number> = {
  title: 1.0, series: 0.85, series_name: 0.8, abstract: 0.65, abstract_weak: 0.35, event_type: 0.5, parent: 0.35,
};

const priority = (w: number) => (w >= 0.85 ? "high priority" : w >= 0.65 ? "priority" : w >= 0.4 ? "medium priority" : "low priority");

export interface Relevance { score: number; tier: Tier; reasons: string[] }

export function scoreEvent(ev: EventData, prefs: Prefs): Relevance {
  if (ev.status === "cancelled" || ev.status === "no_session") {
    return { score: 0, tier: "none", reasons: [ev.status === "cancelled" ? "Cancelled according to the source" : "No session"] };
  }
  const weights = prefs.topic_weights;
  const contribs: { c: number; id: string; field: string; term: string; w: number }[] = [];
  for (const t of ev.topics) {
    const w = weights[t.id] ?? 0;
    if (w <= 0 || !t.evidence.length) continue;
    const best = t.evidence.reduce((a, b) => ((STRENGTH[b.field] ?? 0.5) > (STRENGTH[a.field] ?? 0.5) ? b : a));
    contribs.push({ c: w * (STRENGTH[best.field] ?? 0.5), id: t.id, field: best.field, term: best.term, w });
  }
  contribs.sort((a, b) => b.c - a.c);
  const c = [...contribs.map((x) => x.c), 0, 0, 0];
  let score = 88 * (c[0] + (1 - c[0]) * (0.35 * c[1] + 0.15 * c[2]));

  const reasons: string[] = [];
  for (const x of contribs.slice(0, 3)) {
    const label = TOPIC_BY_ID[x.id].label;
    if (x.field === "title") reasons.push(`Title mentions “${x.term}” — ${label} (${priority(x.w)})`);
    else if (x.field === "abstract" || x.field === "abstract_weak") reasons.push(`Abstract mentions “${x.term}” — ${label} (${priority(x.w)})`);
    else if (x.field === "series") reasons.push(`${x.term} is catalogued under ${label} (${priority(x.w)})`);
    else if (x.field === "series_name") reasons.push(`Series “${x.term}” — ${label} (${priority(x.w)})`);
    else if (x.field === "parent") reasons.push(`${label} (via ${TOPIC_BY_ID[x.term]?.label ?? x.term})`);
    else reasons.push(label);
  }

  let bonus = 0;
  if (ev.series_id && prefs.followed_series.includes(ev.series_id)) {
    bonus += 20;
    reasons.unshift(`Part of ${ev.series_name ?? "a series"}, which you follow`);
  }
  if (ev.speakers.some((s) => prefs.followed_researchers.includes(s.id))) {
    bonus += 25;
    reasons.unshift(`Speaker ${ev.speaker}, whom you follow`);
  }
  if (ev.institution_id && prefs.followed_institutions.includes(ev.institution_id)) {
    bonus += 6;
    reasons.push("At an institution you follow");
  }
  const hit = ev.topics.filter((t) => prefs.followed_topics.includes(t.id) && t.evidence[0]?.field !== "parent").map((t) => t.id);
  if (hit.length) {
    bonus += 8;
    reasons.push("Matches followed topic: " + hit.slice(0, 2).map((h) => TOPIC_BY_ID[h].label).join(", "));
  }
  if (["conference", "workshop", "school"].includes(ev.event_type) && score >= 35) bonus += 4;
  if (ev.event_type === "colloquium") {
    bonus += 5;
    reasons.push("Colloquium — aimed at a broad mathematical audience");
  }
  score += bonus;
  if (ev.status === "tba") {
    score *= 0.7;
    reasons.push("Speaker/title not yet announced");
  }
  if (ev.status === "possibly_removed") {
    score *= 0.5;
    reasons.push("No longer listed on its source — may have been removed");
  }
  if (ev.outside_region) score *= 0.5;
  if (ev.event_type === "outreach" || ev.event_type === "training") score *= 0.4;
  score = Math.round(Math.max(0, Math.min(100, score)));
  const tier: Tier = score >= 65 ? "high" : score >= 40 ? "medium" : score >= 20 ? "low" : "none";
  if (!reasons.length) reasons.push("No topic of your profile detected in the title, abstract or series");
  return { score, tier, reasons };
}
