// Markdown export of the source catalogue (keeps docs/SOURCE_CATALOGUE.md in sync with the data).

import { nowParis, nowUtcIso } from "../src/shared/time";
import { INSTITUTIONS, SOURCES } from "./catalogue";
import type { Store } from "./store";

const REL: Record<string, string> = { very_high: "very high", high: "high", medium_high: "medium/high", medium: "medium", low: "low" };
const cell = (v: unknown) => (v == null || v === "" ? "—" : String(v).replace(/\|/g, "\\|").replace(/\n/g, " "));
const short = (id: string | null) => INSTITUTIONS.find((i) => i.id === id)?.short_name ?? id ?? "";

export function catalogueMarkdown(store: Store): string {
  const now = nowParis();
  const out = [
    "# Source catalogue — Paris mathematical events", "",
    `_Generated on ${nowUtcIso()} (\`npm run catalogue\`)._`, "",
    "Reliability scale: official event page / official calendar → **very high**; department page → **high**; mailing list → **medium/high**; third-party aggregator → **medium**.",
    "Status is the result of the last automatic check (`ok`, `warning`, `error`, `stale` = reachable but not updated, `blocked` = anti-bot wall, `manual` = monitored but not machine-extractable, `never_run`).", "",
    "## 1. Event sources", "",
    "| Source | Institution | URL | Calendar / feed | Extraction method | Update | Reliability | Last status | Upcoming events | Notes |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const s of [...SOURCES].sort((a, b) => short(a.institution_id).localeCompare(short(b.institution_id)) || a.id.localeCompare(b.id))) {
    const st = store.source_status[s.id];
    out.push(`| ${[`${s.name} (\`${s.id}\`)`, short(s.institution_id), s.url, s.calendar_url, s.extraction_method, s.update_frequency,
      REL[s.reliability], st?.status, st?.upcoming_found, s.notes].map(cell).join(" | ")} |`);
  }
  out.push("", "## 2. Seminar series", "",
    "Recurrence, weekday, time and location are only filled when the **official page states them** (see the linked source). Series marked _discovered_ were found automatically.", "",
    "| Series | Institution | Team / department | Organisers | Official page | Calendar | Mailing list | Weekday | Time | Usual place | Recurrence (as stated) | Published in advance | Topics | Upcoming | Origin |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const upcoming = new Map<string, number>();
  for (const e of Object.values(store.events)) {
    if (e.series_id && e.start >= now && e.status === "scheduled") upcoming.set(e.series_id, (upcoming.get(e.series_id) ?? 0) + 1);
  }
  for (const s of Object.values(store.series).sort((a, b) => short(a.institution_id).localeCompare(short(b.institution_id)) || a.name.localeCompare(b.name))) {
    out.push(`| ${[s.name, short(s.institution_id), s.department, s.organizers, s.official_url, s.calendar_url, s.mailing_list, s.typical_weekday,
      s.typical_time, s.typical_location, s.recurrence ? `${s.recurrence}${s.statement_source ? ` — [source](${s.statement_source})` : ""}` : null,
      s.published_in_advance, s.topics.join(", "), upcoming.get(s.id) ?? 0, s.auto_discovered ? "discovered" : "curated"].map(cell).join(" | ")} |`);
  }
  out.push("", "## 3. Math World feeds", "", "| Feed | URL | Kind | Last status | Items | Note |", "|---|---|---|---|---|---|");
  for (const f of Object.values(store.feeds)) out.push(`| ${[f.name, f.url, f.kind, f.status, f.items_found, f.last_error].map(cell).join(" | ")} |`);
  return out.join("\n") + "\n";
}
