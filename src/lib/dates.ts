// All event times are Paris wall-clock strings ("2026-09-24T11:00:00").
// We manipulate them as plain calendar values and never convert time zones.

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A calendar date (no time) as a JS Date at local midnight. */
export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfWeek(d: Date): Date {
  const wd = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(d, -wd);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Minutes since midnight of a wall-clock ISO string. */
export function minutesOf(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

export function hhmm(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "";
}

export function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function fmtLong(d: Date): string {
  return `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtShort(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS_SHORT[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function fmtRange(start: string, end: string | null, allDay: boolean): string {
  if (allDay) {
    if (end && !sameDay(start, end)) return `${fmtShort(start)} – ${fmtShort(end)}`;
    return fmtShort(start);
  }
  const t = `${fmtShort(start)}, ${hhmm(start)}`;
  if (!end) return t;
  if (sameDay(start, end)) return `${t}–${hhmm(end)}`;
  return `${t} – ${fmtShort(end)} ${hhmm(end)}`;
}

/** Current Paris wall-clock time as "YYYY-MM-DDTHH:MM:SS". */
export function parisNowIso(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}:${g("second")}`;
}

export function parisToday(): Date {
  return parseDate(parisNowIso());
}

/** "12 min ago" for a UTC ISO instant ("...Z"). */
export function relTime(utcIso: string | null | undefined): string {
  if (!utcIso) return "never";
  const t = new Date(utcIso).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
