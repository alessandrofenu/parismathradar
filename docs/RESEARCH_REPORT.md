# Research report — the Paris mathematical event ecosystem

_Research carried out on 15 September 2026, before and while building Paris Math Radar._
_Figures marked ⟨…⟩ come from the ingestion run of the same day (see §6)._

## 1. Method

1. Start from each institution's homepage and **follow its own links** to seminar pages, agendas, event
   systems and feeds — not from search-engine snippets. Search was only used to find entry points
   (e.g. the IMJ-PRG event database, the CY Cergy lab site, CMLS).
2. For every candidate source, fetch the **raw HTML/JSON/ICS** and inspect its structure: is there a machine
   interface (REST API, iCal, Indico export)? Does it list *future* sessions? Is it maintained?
3. Record only statements actually printed by the source (organisers, weekday, time, room, recurrence).
4. Write one adapter per source family, run it, and **compare the result with the official pages**
   (`npm run verify`).

## 2. Institutions searched

| Institution | Entry point used | Outcome |
|---|---|---|
| **IMJ-PRG** (Sorbonne Université + Université Paris Cité) | `/seminaires/`, `/gestion/evenement` | Central event database with ~105 series (seminars and working groups, many historical), per-series pages with future sessions and hidden abstracts, per-talk pages and per-talk `.ics`. **Main source.** |
| **Sorbonne Université / Jussieu** | IMJ-PRG, LPSM, LJLL, Indico cat. 250 | Pure maths talks at Jussieu are in the IMJ-PRG database; LPSM & LJLL sites are behind an anti-bot wall (Anubis). |
| **Université Paris Cité / Sophie Germain / Halle aux Farines** | IMJ-PRG (Sophie Germain site), IRIF, MAP5 (Indico cat. 110) | IMJ-PRG covers Sophie Germain seminars; IRIF (same building) runs the category-theory/homotopy working groups with ICS feeds. |
| **Université Sorbonne Paris Nord — LAGA** (with Paris 8) | team seminar pages | A seminar database rendered as HTML per team (8 teams). Its ICS/RSS exports **stopped in June 2023** — HTML is the only up-to-date view. Contains the *Après-midi parisienne de topologie* and *Après-midi topologie algébrique*. |
| **ENS / DMA** | `math.ens.psl.eu` (the `.fr` domain fails TLS) | WordPress *The Events Calendar* REST API — clean structured data, but several ENS series only appear as archives. |
| **Institut Henri Poincaré** | `/fr/agenda`, recurring-seminar page | Paginated agenda (RSS returns HTTP 500); a page listing ~34 hosted recurring seminars with frequency and weekday (Séminaire d'Algèbre, GTIA, RéGA, Symplectix, Séminaire dérivé, Bourbaki, Flajolet…). Most IHP events are also on Indico. |
| **IHES** | `/en/events/` | Tables of seminars, cours and conferences, each linking to Indico (exact deduplication). |
| **Université Paris-Saclay — IMO/LMO (Orsay)** | `/fr/activites/les-evenements-de-limo/` | Event cards + detail pages (speaker, institution, time, room, abstract); includes thesis defences. |
| **École polytechnique — CMLS** | `cmls.ip-paris.fr/…/seminaire-de-geometrie` | Free prose page with inconsistent date headers → **monitored, not scraped** (risk of wrong dates). |
| **CY Cergy Paris Université — AGM** | `cyagm.cyu.fr` | Seminar pages show only 2024 sessions; RSS export empty → flagged **stale**. Cergy events on Indico (cat. 331) are still ingested. |
| **Université Paris Dauphine-PSL — CEREMADE** | seminar pages, Indico cat. 101 | TYPO3 pages with an empty weekly view at check time → **manual**; Indico ingested. |
| **Université Gustave Eiffel / UPEC — LAMA, CERMICS** | Indico cat. 548, 549, 554, 773 | Ingested through Indico; LAMA's own seminar pages are linked from IHP (C-TOP, COOL). |
| **Évry, Versailles, Nanterre, Cnam, Télécom Paris** | Indico sub-categories of *Région Parisienne* | Ingested through Indico (little activity at check time). |
| **PSL institutions** | ENS, Dauphine, Collège de France (gazetteer only) | See above. |
| **FSMP** | news/agenda pages | Mostly calls, programmes and outreach — catalogued only. |
| **Cross-institutional** | Indico CNRS *Région Parisienne* (category 6), mailing lists `sem-top.paris`, `gdt.top.imj-prg` | Indico's JSON export is the best single aggregator of Paris-region events; the mailing lists are catalogued (not machine-readable). |

## 3. Seminar families found

- **Topology / homotopy (highest priority for this profile)**
  - IMJ-PRG: *Séminaire de Topologie* (organisers N. Idrissi, E. Wagner; Tuesdays 10:45–11:45 at Sophie Germain per the
    `sem-top.paris` list description); *Séminaire Géométrie et Topologie* (Jussieu, Thursdays 11:00, room 15-25-502, stated
    on its page); *Groupe de travail Algèbre et Topologie Homotopiques*; *Knot Online Seminar* working group; *Séminaire
    Invariants de nœuds et théorie de Lie supérieure*.
  - LAGA: *Séminaire de l'équipe Topologie Algébrique* (C. De Clercq, B. Vallette, G. Horel) and the irregular
    **topology afternoons** (*Après-midi parisienne de topologie*, *Après-midi topologie algébrique*), plus past
    working groups (Grothendieck–Teichmüller, ∞-categories, factorization homology…).
  - IRIF: *Catégories supérieures, polygraphes et homotopie* (Fridays 14:00, room 1013), *Théorie des types et théorie de
    l'homotopie* (last sessions 2024), *Topos pour la réalisabilité* (reading group).
  - IHP-hosted: *Séminaire Symplectix de topologie symplectique*, *Séminaire dérivé / Derived Seminar*, *RéGA*.
  - Orsay: *Séminaire Géométrie Topologie Dynamique*, *Datashape* (TDA), team days of *Topologie et dynamique*.
  - IHES: *Séminaire Géométrie et groupes discrets*.
- **Algebra / representation theory**: IMJ-PRG *Séminaire d'Algèbre* (held at IHP on Mondays per IHP), *Groupes,
  Représentations et Géométrie*, *Claude Chevalley*, *Groupes Réductifs et Formes Automorphes*; IHP *GTIA*.
- **Algebraic & arithmetic geometry / number theory**: IMJ-PRG *Géométrie algébrique*, *Théorie des Nombres*, *Géométrie
  tropicale*; LAGA *AGA*; Orsay *Arithmétique et Géométrie Algébrique*; IHES *Séminaire de Mathématique*; IHP
  *Rencontres de théorie analytique des nombres*; ENS *Variétés rationnelles* (archive).
- **Geometry & dynamics**: IMJ-PRG *Séminaire de Géométrie*, *Systèmes dynamiques*, *Géométrie hamiltonienne*,
  *Singularités*; LAGA *Systèmes dynamiques*; CMLS *Séminaire de géométrie*; IHP *Géométrie et dynamique dans les espaces de modules*.
- **Logic**: IMJ-PRG *Séminaire Général de Logique*, *Théorie des modèles et groupes*, *Géométrie et théorie des modèles*;
  IRIF *Formath*, *Sémantique*, *LAAG*.
- **Analysis / PDE / probability / mathematical physics**: ENS *Analyse non linéaire et EDP*; IHP *SPIKE*, *C-TOP*,
  *MEGA*, *Problèmes spectraux*; IHES *Séminaire de Physique Théorique*; LAGA PM-EDP, Probabilités; Operator-algebra
  seminars (IMJ-PRG) and the IHP **T3-2026 trimester “Operator algebras”**.
- **General / colloquia**: ENS *Séminaire « Des mathématiques »*, Orsay colloquium (e.g. Kontsevich, 17 Sept 2026),
  **Séminaire Bourbaki** (IHP), IRIF Distinguished Talks.
- **Doctoral / junior**: IMJ-PRG *Séminaire des Thésards*, ENS *Colloquium des doctorant·es*, RéGA, Orsay PhD
  seminars, IHP *Rencontres de rentrée*.

## 4. Sources that were difficult

| Difficulty | Sources | What the app does |
|---|---|---|
| Anti-bot proof-of-work wall | LPSM, LJLL | status `blocked`; would need Playwright with a real browser session |
| Machine feeds exist but are frozen | LAGA ICS/RSS (June 2023), Google Calendar of IMJ *Géométrie et Topologie* (March 2024), IRIF `hott` & `laag` | HTML is used instead where possible; frozen feeds are reported `stale` |
| Unmaintained pages | AGM Cergy (2024 content only), CNRS INSMI RSS (newest item 2022) | `stale` |
| Free-text pages with inconsistent dates | CMLS geometry seminar | `manual` (not scraped, to avoid wrong dates) |
| Placeholder slots | IMJ-PRG publishes a year of weekly “TBA” slots | stored as `tba`, hidden by default, shown as “announced slots” in series panels |
| Series name ≠ talk | Indico/IHP “Derived Seminar”, “Séance de septembre” | the source title is kept verbatim; no speaker is invented |
| Same event, many sources | IHP agenda + Indico; IHES page + Indico; IMJ + Google Calendar | deduplicated, all source links kept |
| Old domains | `math.ens.psl.fr` (TLS error) → `math.ens.psl.eu` | adapter uses the live domain |

## 5. What might still be missing

- **Mailing-list-only announcements** — topology afternoons, special days and reading groups are often
  announced only on `sem-top.paris` or team lists. Subscribing and parsing a mailbox (IMAP) would close
  the largest remaining gap.
- **Researchers' personal pages** hosting informal working groups (e.g. LAGA working groups on personal pages).
- **Probability and PDE at Jussieu** (LPSM, LJLL) — blocked by the bot wall.
- **CMLS, CEREMADE, Cergy** own pages (manual/stale).
- **Collège de France** courses, **Institut Pascal** workshops, **CIRM-style schools** held in Paris, **IHP doctoral
  courses** listed outside the agenda, **Université Paris 8** internal seminars.
- **Thesis defences** outside Orsay (IMJ-PRG and UPC announce them on separate pages or by e-mail).
- The IHP page names ~34 hosted recurring seminars whose own sites (Google Sites, personal pages) are not yet
  scraped; their sessions appear when they use Indico or the IHP agenda.

## 6. Figures from the ingestion of 15 Sept 2026

| Quantity | Value |
|---|---|
| Sources catalogued | 53 (50 with an adapter, 3 catalogued only: FSMP, two mailing lists) |
| Source status after the run | 42 ok · 5 manual · 3 stale · 2 blocked · 1 warning (the IMJ Google Calendar answered HTTP 429; that feed is stale anyway) |
| Seminar series | 218 (27 curated, 191 discovered automatically) — 45 with a recurrence stated by an official page |
| Events stored | 346, of which 327 upcoming (218 with a published speaker or title, 99 announced “TBA” slots, 10 “no session”) |
| Events confirmed by ≥ 2 independent sources (merged) | 42 |
| Upcoming scheduled events by institution | IHP 98 · IMJ-PRG 28 · IMO/LMO 25 · LAGA 23 · ENS 15 · IHES 11 · IRIF 8 · Paris-Saclay 8 · Modal'X 1 · LAMA 1 |
| Upcoming events by type | 136 seminars · 49 conferences/special days · 10 workshops · 4 courses · 3 schools · 3 thesis defences · 3 doctoral · 2 colloquia (+ outreach/training, hidden by default) |
| Upcoming scheduled events with abstract / speaker / identified campus | 73 / 110 / 211 of 218 |
| Speakers | 123 (21 with a homepage linked by the source) |
| Math World | 260 new/cross-listed arXiv entries (8 categories), Quanta 5, IHES 10, Abel Prize 10; CNRS INSMI feed flagged stale (newest item 2022) |
| Published data size | `public/data/events.json` ≈ 600 kB, `catalogue.json` ≈ 200 kB, `news.json` ≈ 200 kB (fetched once by the browser) |

**Verification.** `npm run verify` re-opens the official page of randomly chosen upcoming events and checks that the
date, the title words and the speaker appear there. Two samples (25 events, then 10 after the pipeline was rewritten
in TypeScript) were confirmed **25/25** and **10/10**, across IMJ-PRG, ENS, IHP, Indico, LAGA, IRIF and Orsay.
Manual checks during development also confirmed, e.g., the IMJ-PRG *Séminaire de Topologie* talk of N. Manikandan
(20 Oct 2026, 10:45, Sophie Germain 1016), the IMO colloquium by M. Kontsevich (17 Sept 2026, 14:00, Amphithéâtre
Yoccoz) and the cancellation of H. Abels' talk at ENS (15 Sept 2026). One duplicate found by sampling (an IHP agenda
entry and its Indico twin with a short title) led to an extra deduplication rule.

**Implementation note.** The pipeline was first written in Python and then ported to TypeScript so that the whole
project is a single JS/TS codebase that GitHub Actions can run and GitHub Pages can host. The port reproduced the
same counts source by source, which is itself a useful cross-check of the parsers.

## 7. How to become more comprehensive

1. **Mailing-list ingestion**: a read-only IMAP adapter for `sem-top.paris` & co., extracting date/time/room with
   strict patterns and flagging events as *medium/high* confidence.
2. **Headless-browser adapters** (Playwright) for LPSM/LJLL.
3. **Adapters for IHP-listed series sites** (Google Sites / personal pages) with one small parser each.
4. **researchseminars.org** and **Indico national categories** as cross-checks (medium reliability) to detect missing
   events, never as primary sources.
5. **Crowd-sourced corrections**: a “report a missing seminar” link that adds a source row in `manual` state.
6. Periodic `verify` runs in CI, alerting when the share of confirmed events drops (layout changes).
