// Per-visitor data kept in the browser (localStorage): preferences, personal events, research notebook,
// homepage links added by the user. Exportable/importable as one JSON file.

import { DEFAULT_PREFS, DEFAULT_TOPIC_WEIGHTS } from "./shared/defaults";
import { nowUtcIso } from "./shared/time";
import type { PersonalEvent, Prefs, ResearchItem } from "./shared/types";

const KEYS = { prefs: "mr-prefs", personal: "mr-personal", research: "mr-research", homepages: "mr-homepages" } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage full: keep working in memory */
  }
}

export function loadPrefs(): Prefs {
  const saved = read<Partial<Prefs>>(KEYS.prefs, {});
  return { ...DEFAULT_PREFS, ...saved, topic_weights: { ...DEFAULT_TOPIC_WEIGHTS, ...(saved.topic_weights ?? {}) } };
}
export const savePrefs = (p: Prefs) => write(KEYS.prefs, p);

export const loadPersonal = () => read<PersonalEvent[]>(KEYS.personal, []);
export const savePersonal = (items: PersonalEvent[]) => write(KEYS.personal, items);

export const loadResearch = () => read<ResearchItem[]>(KEYS.research, []);
export const saveResearch = (items: ResearchItem[]) => write(KEYS.research, items);

export const loadHomepages = () => read<Record<string, string>>(KEYS.homepages, {});
export const saveHomepages = (m: Record<string, string>) => write(KEYS.homepages, m);

export const nextId = (items: { id: number }[]) => items.reduce((m, x) => Math.max(m, x.id), 0) + 1;

export interface Backup {
  app: "paris-math-radar";
  version: 1;
  exported_at: string;
  prefs: Prefs;
  personal: PersonalEvent[];
  research: ResearchItem[];
  homepages: Record<string, string>;
}

export function exportBackup(): Backup {
  return { app: "paris-math-radar", version: 1, exported_at: nowUtcIso(), prefs: loadPrefs(), personal: loadPersonal(), research: loadResearch(), homepages: loadHomepages() };
}

export function importBackup(data: unknown): void {
  const b = data as Partial<Backup>;
  if (!b || b.app !== "paris-math-radar") throw new Error("Not a Paris Math Radar backup file");
  if (b.prefs) savePrefs({ ...DEFAULT_PREFS, ...b.prefs });
  if (Array.isArray(b.personal)) savePersonal(b.personal);
  if (Array.isArray(b.research)) saveResearch(b.research);
  if (b.homepages) saveHomepages(b.homepages);
}
