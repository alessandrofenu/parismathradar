// Minimal iCalendar (RFC 5545) reader: VEVENT properties, TZID/UTC/floating/date values → Paris wall-clock.

import { instantToParis, wall, zonedToParis } from "../src/shared/time";

export interface IcsProp { value: string; params: Record<string, string> }
export type IcsEvent = Record<string, IcsProp[]>;

function splitLine(line: string): [string, string] {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) return [line.slice(0, i), line.slice(i + 1)];
  }
  return [line, ""];
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: IcsEvent[] = [];
  const stack: string[] = [];
  let cur: IcsEvent | null = null;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const [head, value] = splitLine(raw);
    const [name, ...paramParts] = head.split(";");
    const upper = name.toUpperCase();
    if (upper === "BEGIN") {
      stack.push(value.toUpperCase());
      if (value.toUpperCase() === "VEVENT" && stack.length <= 2) cur = {};
      continue;
    }
    if (upper === "END") {
      const closed = stack.pop();
      if (closed === "VEVENT" && cur) {
        events.push(cur);
        cur = null;
      }
      continue;
    }
    if (!cur || stack[stack.length - 1] !== "VEVENT") continue;
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v = ""] = p.split("=");
      params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
    }
    (cur[upper] ??= []).push({ value, params });
  }
  return events;
}

export function icsText(ev: IcsEvent, name: string): string | null {
  const p = ev[name]?.[0];
  if (!p) return null;
  return p.value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Returns [Paris wall-clock ISO, allDay] or null. */
export function icsDate(ev: IcsEvent, name: string): [string, boolean] | null {
  const p = ev[name]?.[0];
  if (!p) return null;
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, H, M, S, z] = m;
  if (!H || p.params.VALUE === "DATE") return [wall(+y, +mo, +d), true];
  if (z) return [instantToParis(Date.UTC(+y, +mo - 1, +d, +H, +M, +(S ?? 0))), false];
  return [zonedToParis(wall(+y, +mo, +d, +H, +M, +(S ?? 0)), p.params.TZID), false];
}
