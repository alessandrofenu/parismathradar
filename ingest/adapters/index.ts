import type { Adapter } from "../models";
import { ens } from "./ens";
import { ical } from "./ical";
import { ihes } from "./ihes";
import { ihp, ihpRecurrent } from "./ihp";
import { imj } from "./imj";
import { imo } from "./imo";
import { indico } from "./indico";
import { laga } from "./laga";
import { probe } from "./probe";

export const ADAPTERS: Record<string, Adapter> = {
  imj, ens, indico, ical, laga, ihp, ihp_recurrent: ihpRecurrent, ihes, imo, probe,
};
