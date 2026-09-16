export type * from "./shared/types";
export type { MathEvent, RankedSeries, DecoratedPlace } from "./data";

export interface Filters {
  minScore: number;
  areas: string[];
  institutions: string[];
  types: string[];
  showPersonal: boolean;
}
