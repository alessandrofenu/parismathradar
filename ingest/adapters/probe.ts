// Probe adapter: monitors sources that cannot (yet) be extracted automatically. Never produces events;
// reports reachability, bot walls and apparent staleness so the Sources page shows where coverage is incomplete.

import { nowParis } from "../../src/shared/time";
import { emptyResult, type Adapter } from "../models";
import { httpGet, looksLikeBotWall } from "../util";

export const probe: Adapter = async (source, params) => {
  const res = emptyResult();
  const urls: string[] = params.urls ?? [source.url];
  const now = nowParis();
  const month = +now.slice(5, 7), year = +now.slice(0, 4);
  const academicYearStart = month >= 8 ? year : year - 1;
  const notes: string[] = [];
  let newest = 0;
  for (const url of urls) {
    const f = await httpGet(url);
    if (f.status >= 400) throw new Error(`HTTP ${f.status} for ${url}`);
    if (looksLikeBotWall(f.text)) {
      res.status_override = "blocked";
      res.message = "Page is behind an anti-bot challenge; needs a headless browser or manual checking.";
      return res;
    }
    const years = (f.text.match(/\b20[12]\d\b/g) ?? []).map(Number);
    const counts = new Map<number, number>();
    years.forEach((y) => counts.set(y, (counts.get(y) ?? 0) + 1));
    const dense = [...counts].filter(([, n]) => n >= 2).map(([y]) => y); // ignore footer-only mentions
    const y = dense.length ? Math.max(...dense) : 0;
    newest = Math.max(newest, y);
    notes.push(`${url.split("/").filter(Boolean).pop()}: latest year mentioned ${y || "none"}`);
  }
  if (params.expect === "fresh" && newest < academicYearStart) {
    res.status_override = "stale";
    res.message = `No ${academicYearStart}–${academicYearStart + 1} dates found (latest year mentioned: ${newest || "none"}). The source may be unmaintained. ${notes.join("; ")}`;
  } else {
    res.status_override = "manual";
    res.message = `Reachable, but not machine-extractable reliably; check manually. ${notes.join("; ")}`;
  }
  return res;
};
