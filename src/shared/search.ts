// Query understanding for the search box: "Jussieu Thursday", "topology next week", "Cergy algebra"…

import { addDays } from "./time";
import { TOPICS } from "./taxonomy";
import { escapeRe, norm } from "./text";

export interface SearchSpec {
  weekday: number | null; // Monday = 0
  range: [string, string] | null; // YYYY-MM-DD inclusive
  places: string[];
  institutions: string[];
  topics: string[];
  text: string[];
}

const WEEKDAYS: Record<string, number> = {
  monday: 0, lundi: 0, tuesday: 1, mardi: 1, wednesday: 2, mercredi: 2, thursday: 3, jeudi: 3, friday: 4, vendredi: 4,
  saturday: 5, samedi: 5, sunday: 6, dimanche: 6,
};

const PLACE_ALIASES: Record<string, string[]> = {
  jussieu: ["jussieu"], "sophie germain": ["sophie-germain"], germain: ["sophie-germain"], ens: ["ens-ulm"], ulm: ["ens-ulm"], ihp: ["ihp"],
  poincare: ["ihp"], ihes: ["ihes"], bures: ["ihes"], orsay: ["orsay"], saclay: ["orsay", "polytechnique", "saclay-plateau", "ihes"],
  polytechnique: ["polytechnique"], palaiseau: ["polytechnique"], villetaneuse: ["villetaneuse"], laga: ["villetaneuse"], cergy: ["cergy"],
  pontoise: ["cergy"], dauphine: ["dauphine"], creteil: ["upec"], champs: ["champs-sur-marne"], marne: ["champs-sur-marne"],
  evry: ["evry"], versailles: ["versailles"], nanterre: ["nanterre"],
};

const INSTITUTION_ALIASES: Record<string, string> = {
  imj: "imj-prg", "imj-prg": "imj-prg", irif: "irif", laga: "laga", ihp: "ihp", ihes: "ihes", ens: "ens-dma", dma: "ens-dma", cmls: "cmls",
  agm: "agm", cergy: "agm", orsay: "lmo", lmo: "lmo", imo: "lmo", dauphine: "ceremade", ceremade: "ceremade", lama: "lama",
};

const TOPIC_ALIASES: Record<string, string> = {
  ...Object.fromEntries(TOPICS.map((t) => [norm(t.label), t.id])),
  topology: "topology", topologie: "topology", homotopy: "homotopy-theory", homotopie: "homotopy-theory", algebra: "algebra",
  algebre: "algebra", geometry: "geometry", geometrie: "geometry", category: "category-theory", categories: "category-theory",
  logic: "logic", logique: "logic", probability: "probability", probabilites: "probability", "number theory": "number-theory",
  analysis: "analysis", analyse: "analysis", pde: "pde", edp: "pde", tda: "tda", "k-theory": "k-theory", dynamics: "dynamical-systems",
  combinatorics: "combinatorics", combinatoire: "combinatorics", operads: "higher-algebra", operad: "higher-algebra",
  braids: "braid-groups", braid: "braid-groups", "configuration spaces": "configuration-spaces", moduli: "moduli-spaces",
};

const STOP = new Set(["the", "le", "la", "les", "de", "des", "in", "at", "a"]);

/** today: "YYYY-MM-DD" (Paris). */
export function parseSearch(q: string, today: string): SearchSpec {
  let n = norm(q);
  const spec: SearchSpec = { weekday: null, range: null, places: [], institutions: [], topics: [], text: [] };
  const t0 = `${today}T00:00:00`;
  const wd = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(t0, -wd);
  const [y, m] = today.split("-").map(Number);
  const monthStart = (yy: number, mm: number) => `${yy + Math.floor((mm - 1) / 12)}-${String(((mm - 1) % 12) + 1).padStart(2, "0")}-01T00:00:00`;
  const d = (iso: string) => iso.slice(0, 10);
  const ranges: [RegExp, [string, string]][] = [
    [/\btoday\b|\baujourd'?hui\b/, [today, today]],
    [/\btomorrow\b|\bdemain\b/, [d(addDays(t0, 1)), d(addDays(t0, 1))]],
    [/\bthis week\b|\bcette semaine\b/, [d(monday), d(addDays(monday, 6))]],
    [/\bnext week\b|\bsemaine prochaine\b/, [d(addDays(monday, 7)), d(addDays(monday, 13))]],
    [/\bthis month\b|\bce mois\b/, [d(monthStart(y, m)), d(addDays(monthStart(y, m + 1), -1))]],
    [/\bnext month\b|\bmois prochain\b/, [d(monthStart(y, m + 1)), d(addDays(monthStart(y, m + 2), -1))]],
  ];
  for (const [re, r] of ranges) {
    if (re.test(n)) {
      spec.range = r;
      n = n.replace(re, " ");
    }
  }
  for (const [w, i] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b${w}s?\\b`);
    if (re.test(n)) {
      spec.weekday = i;
      n = n.replace(re, " ");
    }
  }
  for (const phrase of Object.keys(TOPIC_ALIASES).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRe(phrase)}\\b`);
    if (phrase.length > 2 && re.test(n)) {
      spec.topics.push(TOPIC_ALIASES[phrase]);
      spec.text.push(phrase);
      n = n.replace(re, " ");
    }
  }
  for (const [alias, ids] of Object.entries(PLACE_ALIASES)) {
    const re = new RegExp(`\\b${escapeRe(alias)}\\b`);
    if (re.test(n)) {
      spec.places.push(...ids);
      if (INSTITUTION_ALIASES[alias]) spec.institutions.push(INSTITUTION_ALIASES[alias]);
      n = n.replace(re, " ");
    }
  }
  for (const [alias, id] of Object.entries(INSTITUTION_ALIASES)) {
    const re = new RegExp(`\\b${escapeRe(alias)}\\b`);
    if (re.test(n)) {
      spec.institutions.push(id);
      n = n.replace(re, " ");
    }
  }
  spec.text.push(...(n.match(/[\w\-']+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)));
  spec.places = [...new Set(spec.places)];
  spec.institutions = [...new Set(spec.institutions)];
  return spec;
}
