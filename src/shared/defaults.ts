// Default interest profile and preferences. Visitors can change everything in the Following page
// (stored in their browser); edit this file to change what a first-time visitor sees.

import type { Prefs } from "./types";

// 1.0 = high, ~0.55 = medium, ~0.25 = low, 0 = off.
export const DEFAULT_TOPIC_WEIGHTS: Record<string, number> = {
  "algebraic-topology": 1.0, "homotopy-theory": 1.0, "configuration-spaces": 1.0, topology: 0.9, "braid-groups": 0.9, geometry: 0.8,
  "low-dim-topology": 0.8, algebra: 0.75, "homological-algebra": 0.9, "category-theory": 0.9, "higher-categories": 0.9,
  "higher-algebra": 0.9, "k-theory": 0.85, "geometric-group-theory": 0.85, tda: 0.8, "derived-geometry": 0.75, "moduli-spaces": 0.7,
  "number-theory": 0.5, "representation-theory": 0.55, "algebraic-geometry": 0.55, "mathematical-physics": 0.5,
  "dynamical-systems": 0.45, analysis: 0.35, symplectic: 0.6, "differential-geometry": 0.55, "tropical-geometry": 0.5,
  "arithmetic-geometry": 0.45, "group-theory": 0.55, logic: 0.4, combinatorics: 0.4, "operator-algebras": 0.3, probability: 0.2,
  pde: 0.2, applied: 0.1, history: 0.3, general: 0.35,
};

export const DEFAULT_PREFS: Prefs = {
  topic_weights: DEFAULT_TOPIC_WEIGHTS,
  followed_series: ["imj-43", "imj-77", "laga-sta", "irif-cat", "imj-24"],
  followed_institutions: ["laga"],
  followed_researchers: [],
  followed_topics: ["homotopy-theory", "category-theory", "configuration-spaces"],
  origins: [
    { id: "home", label: "Home", location_id: null, lat: null, lon: null },
    { id: "university", label: "University", location_id: "sophie-germain", lat: null, lon: null },
  ],
  default_origin: "university",
  arxiv_categories: ["math.AT", "math.GT", "math.AG", "math.CT", "math.KT", "math.QA", "math.CO", "math.DS"],
  arxiv_keywords: ["configuration space", "operad", "little disks", "E_n", "braid", "homotopy", "infinity-categor", "∞-categor",
    "higher categor", "K-theory", "factorization homology", "mapping class", "rational homotopy", "persistent homology", "Koszul",
    "moduli space", "Goodwillie", "Poincaré duality", "spectral sequence"],
  show_placeholders: false,
  show_outside_region: false,
  show_outreach: false,
  day_start_hour: 8,
  day_end_hour: 20,
};
