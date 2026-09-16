import { createContext, useContext } from "react";
import type { Dataset } from "./data";
import type { Topic } from "./shared/taxonomy";
import type { PersonalEvent, Prefs, ResearchItem } from "./shared/types";

export interface AppCtx {
  ds: Dataset;
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  topicById: Record<string, Topic>;
  personal: PersonalEvent[];
  savePersonalItem: (item: Omit<PersonalEvent, "id"> & { id?: number }) => void;
  deletePersonalItem: (id: number) => void;
  research: ResearchItem[];
  saveResearchItem: (item: Omit<ResearchItem, "id" | "created" | "updated"> & { id?: number }) => void;
  deleteResearchItem: (id: number) => void;
  homepages: Record<string, string>;
  setHomepage: (researcherId: string, url: string) => void;
  openEvent: (id: string) => void;
  openResearcher: (id: string) => void;
  openSeries: (id: string) => void;
  toast: (msg: string) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(AppContext);
  if (!c) throw new Error("AppContext missing");
  return c;
}
