// Command-line entry point: `tsx ingest/cli.ts <command>` (see package.json scripts).

import { writeFileSync } from "node:fs";
import { catalogueMarkdown } from "./docs";
import { fetchArxiv, fetchFeeds } from "./news";
import { Pipeline } from "./pipeline";
import { exportPublic, loadStore, prune, saveStore } from "./store";
import { verify } from "./verify";

const [cmd = "help", ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(name);
const opt = (name: string, def: string) => {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("-") ? rest[i + 1] : def;
};
const list = (name: string) => {
  const i = rest.indexOf(name);
  if (i < 0) return null;
  const out: string[] = [];
  for (let j = i + 1; j < rest.length && !rest[j].startsWith("--"); j++) out.push(rest[j]);
  return out;
};

async function main() {
  const store = loadStore();
  switch (cmd) {
    case "ingest": {
      const only = list("--source");
      console.log("Ingesting event sources…");
      const results = await new Pipeline(store).runAll(only);
      console.log(`Done: ${results.length} sources, ${results.filter((r) => r.status === "error").length} error(s).`);
      if (!flag("--skip-news") && !only) {
        console.log("Ingesting Math World feeds…");
        await fetchArxiv(store);
        await fetchFeeds(store);
      }
      prune(store);
      saveStore(store);
      exportPublic(store);
      break;
    }
    case "news":
      await fetchArxiv(store);
      await fetchFeeds(store);
      prune(store);
      saveStore(store);
      exportPublic(store);
      break;
    case "reclassify":
      console.log(`reclassified ${new Pipeline(store).reclassifyAll()} events`);
      saveStore(store);
      exportPublic(store);
      break;
    case "export":
      exportPublic(store);
      console.log(`exported ${Object.keys(store.events).length} events to public/data/`);
      break;
    case "verify": {
      const share = await verify(store, +opt("-n", "15"), +opt("--days", "30"), +opt("--seed", "1"));
      if (flag("--strict") && share < 0.8) process.exitCode = 1;
      break;
    }
    case "catalogue": {
      const md = catalogueMarkdown(store);
      const out = opt("-o", "");
      if (out) {
        writeFileSync(out, md);
        console.log(`wrote ${out}`);
      } else process.stdout.write(md);
      break;
    }
    default:
      console.log(`Usage: tsx ingest/cli.ts <command>
  ingest [--source ID ...] [--skip-news]   run adapters (suffix * for prefix match, e.g. indico-*), then news
  news                                     refresh arXiv + news feeds
  reclassify                               recompute merges/topics from stored records (no network)
  export                                   write public/data/*.json from data/store.json
  verify [-n 15] [--days 30] [--seed 1] [--strict]   spot-check events against official pages
  catalogue [-o docs/SOURCE_CATALOGUE.md]  source catalogue as Markdown`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
