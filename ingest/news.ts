// "Math World" ingestion: arXiv listings + a short whitelist of reliable feeds.
// Summaries are extracted from the sources (first sentences), never generated.

import { XMLParser } from "fast-xml-parser";
import { nowUtcIso } from "../src/shared/time";
import { ARXIV_CATEGORIES, FEEDS } from "./catalogue";
import type { Store } from "./store";
import { errMessage, htmlToText, httpGet, sha } from "./util";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const txt = (v: unknown): string => (v == null ? "" : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v));
const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const iso = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, "Z");
};

export function sentences(text: string | null, n = 2, limit = 340): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  const out = t.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý$\\(])/).slice(0, n).join(" ");
  return out.length > limit ? out.slice(0, limit).replace(/\s+\S*$/, "") + "…" : out;
}

function setFeed(store: Store, id: string, name: string, url: string, kind: string, status: string, items: number | null, error: string | null) {
  store.feeds[id] = { id, name, url, kind, status, last_check: nowUtcIso(), last_error: error, items_found: items };
}

export async function fetchArxiv(store: Store, log = console.log) {
  const url = `https://rss.arxiv.org/rss/${ARXIV_CATEGORIES.join("+")}`;
  const name = `arXiv listings (${ARXIV_CATEGORIES.join(", ")})`;
  try {
    const f = await httpGet(url);
    if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
    const items = arr(parser.parse(f.text)?.rss?.channel?.item);
    let n = 0;
    for (const it of items as Record<string, unknown>[]) {
      const announce = txt(it["arxiv:announce_type"]);
      if (announce !== "new" && announce !== "cross") continue;
      const link = txt(it.link);
      const id = link.replace(/\/$/, "").split("/").pop()!;
      const desc = txt(it.description);
      const abstract = (desc.match(/Abstract:\s*([\s\S]*)/)?.[1] ?? desc).trim();
      const cats = arr(it.category).map(txt);
      store.news[`arxiv:${id}`] = {
        id: `arxiv:${id}`, kind: "arxiv", title: txt(it.title).replace(/\s+/g, " ").trim(), summary: sentences(abstract, 3, 700), url: link,
        source: `arXiv ${cats[0] ?? ""}`.trim(), authors: txt(it["dc:creator"]) || null, categories: cats, published: iso(txt(it.pubDate)),
      };
      n++;
    }
    setFeed(store, "arxiv", name, url, "arxiv", n ? "ok" : "warning", n, n ? null : "No new/cross-listed entries (weekend or holiday listing?)");
    log(`  ✓ arXiv: ${n} new/cross-listed entries`);
  } catch (e) {
    setFeed(store, "arxiv", name, url, "arxiv", "error", null, errMessage(e));
    log(`  ✗ arXiv: ${errMessage(e)}`);
  }
}

export async function fetchFeeds(store: Store, log = console.log) {
  for (const [id, name, url, kind] of FEEDS) {
    try {
      const f = await httpGet(url);
      if (f.status !== 200) throw new Error(`HTTP ${f.status}`);
      const doc = parser.parse(f.text);
      const entries = doc?.rss ? arr(doc.rss.channel?.item) : arr(doc?.feed?.entry);
      let n = 0, newest = "";
      for (const e of entries.slice(0, 30) as Record<string, any>[]) {
        const link = typeof e.link === "object" && !Array.isArray(e.link) ? e.link["@_href"] ?? txt(e.link) : Array.isArray(e.link) ? e.link[0]?.["@_href"] : txt(e.link);
        const published = iso(txt(e.pubDate ?? e.published ?? e.updated));
        const title = htmlToText(txt(e.title)) ?? "(untitled)";
        store.news[`${id}:${sha(link || title)}`] = {
          id: `${id}:${sha(link || title)}`, kind, title, summary: sentences(htmlToText(txt(e.description ?? e.summary ?? e.content))), url: link || url,
          source: name, authors: null, categories: [], published,
        };
        n++;
        if (published && published > newest) newest = published;
      }
      const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
      const stale = !!newest && newest < yearAgo;
      setFeed(store, id, name, url, kind, stale ? "stale" : n ? "ok" : "warning", n, stale ? `Newest item ${newest.slice(0, 10)} — feed appears unmaintained` : null);
      log(`  ${stale ? "!" : "✓"} ${name}: ${n} items${newest ? ` (newest ${newest.slice(0, 10)})` : ""}`);
    } catch (e) {
      setFeed(store, id, name, url, kind, "error", null, errMessage(e));
      log(`  ✗ ${name}: ${errMessage(e)}`);
    }
  }
}
