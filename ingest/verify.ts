// Re-open the official page of a random sample of upcoming events and check that date, title and speaker appear there.

import * as cheerio from "cheerio";
import { norm } from "../src/shared/text";
import { addDays, nowParis } from "../src/shared/time";
import type { Store } from "./store";
import { errMessage, httpGet } from "./util";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function verify(store: Store, n = 15, days = 30, seed = 1): Promise<number> {
  const now = nowParis();
  const rows = Object.values(store.events).filter((e) => e.start >= now && e.start <= addDays(now, days) && e.status === "scheduled" && e.official_url);
  const rnd = mulberry32(seed);
  const sample = [...rows].sort(() => rnd() - 0.5).slice(0, n);
  let ok = 0;
  for (const ev of sample) {
    let page: string;
    try {
      const f = await httpGet(ev.official_url!);
      page = norm(cheerio.load(f.text).text());
    } catch (e) {
      console.log(`  ✗ ${ev.title.slice(0, 60)} — fetch failed: ${errMessage(e)}`);
      continue;
    }
    const [y, m, d] = ev.start.slice(0, 10).split("-");
    const dateOk = page.includes(ev.start.slice(0, 10)) || page.includes(`${d}/${m}/${y}`) || (page.includes(String(+d)) && page.includes(y));
    const words = (norm(ev.title).match(/[\p{L}\p{N}]{5,}/gu) ?? []).slice(0, 4);
    const titleOk = !words.length || words.filter((w) => page.includes(w)).length >= Math.max(1, Math.floor(words.length / 2));
    const speakerOk = !ev.speaker || (norm(ev.speaker).match(/[\p{L}]{3,}/gu) ?? []).some((p) => page.includes(p));
    const good = dateOk && titleOk && speakerOk;
    if (good) ok++;
    console.log(`  ${good ? "✓" : "✗"} ${ev.start.slice(0, 16)} | ${ev.title.slice(0, 55).padEnd(55)} | ${(ev.speaker ?? "—").slice(0, 25).padEnd(25)} | `
      + `date:${dateOk ? "ok" : "NO"} title:${titleOk ? "ok" : "NO"} speaker:${speakerOk ? "ok" : "NO"} | ${ev.official_url}`);
  }
  console.log(`${ok}/${sample.length} sampled events confirmed on their official pages.`);
  return sample.length ? ok / sample.length : 1;
}
