import type { Adapter } from "../models";
import { cergyGeoDyn } from "./cergy";
import { ens } from "./ens";
import { ical } from "./ical";
import { ihes } from "./ihes";
import { ihp, ihpRecurrent } from "./ihp";
import { imj } from "./imj";
import { imo } from "./imo";
import { indico } from "./indico";
import { laga } from "./laga";
import { m2fonda } from "./m2fonda";
import { probe } from "./probe";

export const ADAPTERS: Record<string, Adapter> = {
  imj, ens, indico, ical, laga, ihp, ihp_recurrent: ihpRecurrent, ihes, imo, probe, cergy_geodyn: cergyGeoDyn, m2fonda,
};
