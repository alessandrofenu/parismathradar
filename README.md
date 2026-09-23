# Paris Math Radar

**A mathematical calendar for Paris.** Seminars, working groups, topology afternoons, colloquia, conferences,
thesis defences and research programmes from the Paris mathematical ecosystem — collected automatically from
official sources, deduplicated, and ranked for your own research interests. Next to the calendar, a compact
**Math World** panel shows recent mathematical news and new arXiv preprints matching your keywords.

No server, no database, no account: a **static site** (GitHub Pages) plus a **TypeScript ingestion job**
(GitHub Actions) that refreshes the data and commits it back to the repository. Everything personal —
interests, followed seminars, personal events, notes — stays in your browser.

```
 official sites → ingest (Node/TypeScript, scheduled) → data/store.json → public/data/*.json → static site
```

- **Today** as a timeline, with *What should I attend today?* explaining each recommendation.
- **Week** (heat bar per day) and **month** (days shaded by how much relevant mathematics happens).
- Each event opens a panel with the official page, every source that reported it, reliability, last
  verification, detected changes, a travel estimate and the abstract (TeX rendered).
- **Discover** ranks 200+ series; **Following** holds your interests and follows; **Research** is a small
  notebook; **Sources** shows the health of every source, including the ones that cannot be scraped.

Nothing is invented: fields no source publishes appear as *Information unavailable*, and a recurrence is shown
only when an official page states it (with a link to where it says so).

Companion documents: [`docs/SOURCE_CATALOGUE.md`](docs/SOURCE_CATALOGUE.md) (every source and series found)
and [`docs/RESEARCH_REPORT.md`](docs/RESEARCH_REPORT.md) (what was searched, what is hard, what is missing).

---

## 1. Quick start

Requirements: **Node ≥ 20** (nothing else).

```bash
npm install
npm run dev       # http://localhost:5173
```

`npm run dev` regenerates `public/data/*.json` from the committed `data/store.json`, so the app has data
immediately. To refresh it from the live websites (~2–3 minutes of polite crawling):

```bash
npm run ingest
```

Build the static site into `dist/`:

```bash
npm run build && npm run preview
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | export data + Vite dev server |
| `npm run build` | export data + production build into `dist/` |
| `npm run ingest` | run every source adapter, then the Math World feeds; updates `data/store.json` and `public/data/` |
| `npm run ingest -- --source imj-gestion indico-*` | run selected sources only (`*` = prefix match) |
| `npm run news` | refresh arXiv + news feeds only |
| `npm run reclassify` | recompute merges, topics and scores from stored records after editing the taxonomy (no network) |
| `npm run export` | rewrite `public/data/*.json` from `data/store.json` |
| `npm run verify -- -n 20` | re-open the official page of random upcoming events and check date, title and speaker |
| `npm run catalogue` | regenerate `docs/SOURCE_CATALOGUE.md` |
| `npm run typecheck` | type-check the site and the ingestion code |

### Keyboard shortcuts

`t` today · `←/→` or `j/k` previous/next · `d w m` day/week/month · `n` new personal event · `f` filters ·
`/` search · `Esc` close panel · `?` help.

---

## 2. Publishing your own copy

1. Fork or create the repository and push this code.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions: Read and write** (so the update job can commit data).
4. Push to `main` (or run the *Deploy to GitHub Pages* workflow): the site appears at
   `https://<user>.github.io/<repo>/`. The build uses a relative base, so any path works.
5. The *Update data* workflow runs four times a day, re-reads every source, regenerates the catalogue
   document, spot-checks a sample of events and commits the result. Run it manually from the Actions tab at any
   time (optionally for selected sources).

Optional: set a repository variable `MATHRADAR_CONTACT` (e.g. your repository or contact URL). It is sent in
the crawler's User-Agent so site administrators can identify the traffic; it defaults to the repository URL.

The site is static, so it can equally be served by Netlify, Vercel, Cloudflare Pages or `npx serve dist`.
Only the scheduled ingestion needs Node.

---

## 3. Architecture

```
ingest/                     Node/TypeScript ingestion (runs in CI or locally)
  catalogue.ts              institutions, sources, curated series (verified statements only)
  adapters/                 one adapter per source family
    imj.ts ens.ts indico.ts ical.ts laga.ts ihp.ts ihes.ts imo.ts cergy.ts m2fonda.ts probe.ts
  pipeline.ts               normalise → dedupe/merge → classify → store; change & stale detection
  store.ts                  data/store.json (state) + public/data/*.json (published)
  news.ts                   arXiv + RSS ingestion
  verify.ts docs.ts cli.ts  spot-check, catalogue export, CLI
  util.ts ics.ts fuzz.ts    polite HTTP, iCalendar reader, string similarity

src/shared/                 used by BOTH the ingestion job and the browser
  taxonomy.ts               topics, keyword rules with exclusions, event-type detection
  relevance.ts              0–100 score + human-readable reasons
  locations.ts              campus gazetteer, matching, travel estimates, map links
  search.ts time.ts text.ts defaults.ts types.ts

src/                        the static web app (React + TypeScript, no framework runtime)
  data.ts                   loads the JSON and answers every query the UI needs
  userStore.ts              preferences, personal events, notes (localStorage) + export/import
  pages/ components/ lib/   calendar views, drawers, discover/following/research/sources pages

data/store.json             committed pipeline state: events, per-source records, changes, series, run log
public/data/*.json          generated for the browser (events, catalogue, news) — not committed
```

**Why two JSON layers.** `data/store.json` keeps every *source record* separately, so merges, change detection
and reclassification are reproducible and reviewable in a pull request. `public/data/*.json` is the flattened
view the browser downloads (≈ 1 MB, fetched once).

**Relevance is computed in the browser**, from your own weights — which is why changing an interest slider
instantly re-ranks the calendar without any rebuild.

---

## 4. Event ingestion

Each adapter is `(source, params) => Promise<AdapterResult>` and returns only what the source states. Then the
pipeline:

1. **normalises** times to Paris wall-clock, detects cancellations/placeholders, matches the location text
   against the campus gazetteer (recording *how* the campus was identified);
2. looks up `(source, external_id)`; if new, searches for a **duplicate** among events of the same day
   (same official URL, or close time + fuzzy speaker/title, or same series slot, or identical multi-day title);
3. stores the source record, **recomputes** the merged event from all its records, logs **changes** reported by
   that source (speaker, title, time, room, status) and updates `last_verified`;
4. recomputes **topics with evidence**, speakers and the relevance inputs;
5. flags events that disappeared from a source publishing a complete future listing as `possibly_removed`;
6. writes the source status (`ok`, `warning`, `error`, `stale`, `blocked`, `manual`) shown on the Sources page.

An adapter failure never stops a run: it is recorded and displayed. Crawling is deliberately polite — one
request at a time per host with a minimum delay, an identifying User-Agent, and detail pages fetched only for
the next few weeks.

**Statuses.** `scheduled`, `cancelled`, `tba` (announced slot without speaker — hidden by default),
`no_session` (holidays), `possibly_removed`.

**Confidence.** Official event system / API / calendar → *very high*; official catalogue page → *high*;
mailing list → *medium/high*. A record carrying only a name (e.g. a Google Calendar of speakers) is *weak*:
it can confirm an event but never provides its title.

---

## 5. Adding a source or an institution

**A source with an ICS feed** — add an entry to `SOURCES` in `ingest/catalogue.ts`:

```ts
S({ id: "mylab-topo", name: "MyLab — Topology seminar", institution_id: "mylab", adapter: "ical",
    params: { url: "https://…/seminar.ics", series_id: "mylab-topo", location_hint: "jussieu",
              official_url: "https://…/seminar" },
    url: "https://…/seminar", calendar_url: "https://…/seminar.ics", extraction_method: "ICS" }),
```

**A lab on Indico CNRS** — add `[categoryId, institutionId, label]` to `INDICO_PARIS_CATEGORIES`.

**A lab with its own HTML** — create `ingest/adapters/mylab.ts`:

```ts
import { emptyResult, type Adapter } from "../models";
import { httpGet } from "../util";
import { nowParis, addDays } from "../../src/shared/time";

export const mylab: Adapter = async (source) => {
  const res = emptyResult();
  const page = await httpGet(source.url);
  // parse; never guess a missing field
  res.events.push({ external_id: "…", title: "…", start: "2026-10-01T14:00:00", official_url: "…" });
  res.complete_window = [nowParis(), addDays(nowParis(), 90)]; // only if the page lists ALL future events
  return res;
};
```

register it in `ingest/adapters/index.ts`, add the institution to `INSTITUTIONS` and, if needed, the campus to
`PLACES` in `src/shared/locations.ts` (with patterns recognising its room/building strings). Then:

```bash
npm run ingest -- --source mylab-topo
```

If a page cannot be parsed reliably, use `adapter: "probe"`: it monitors reachability and freshness and makes
the gap visible instead of producing doubtful events.

After editing `src/shared/taxonomy.ts`, run `npm run reclassify`.

---

## 6. Relevance

`score = 88 × (c₁ + (1 − c₁)(0.35 c₂ + 0.15 c₃)) + bonuses`, where `cᵢ = weight(topic) × strength(evidence)`
in decreasing order. Evidence strength: title 1.0, series catalogue 0.85, series name 0.8, abstract 0.65
(0.35 for a single generic hit), inherited parent topic 0.35. Bonuses: followed series +20, followed speaker
+25, followed topic +8, followed institution +6, colloquium +5; TBA slots ×0.7. Tiers: ★★★ ≥ 65, ★★ ≥ 40,
★ ≥ 20. Every reason shown in the interface corresponds to one of these terms — edit your weights in
**Following**, or change the defaults in `src/shared/defaults.ts` for a fork aimed at another field.

## 7. Privacy

The site loads three JSON files and nothing else: no analytics, no cookies, no account, no external requests
except the links you click. Preferences, personal events and notes live in `localStorage` (export/import from
Following). Geolocation is never requested unless you press *Use current location*.

## 8. Contributing

Missing seminar? Open an issue with its official page, or add a source as described above and send a pull
request — `npm run ingest -- --source <id>` shows what it produces before you commit. Please keep the golden
rule: **never write a field a source does not state.**

Licence: [MIT](LICENSE). Event data belongs to the institutions listed in the source catalogue; every event
keeps a link to its official page.
