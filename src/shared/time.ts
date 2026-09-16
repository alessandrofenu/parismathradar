// Times are Europe/Paris wall-clock strings "YYYY-MM-DDTHH:MM:SS"; instants are UTC "YYYY-MM-DDTHH:MM:SSZ".
// Arithmetic on wall-clock values is done by treating them as if they were UTC (no DST surprises).

const pad = (n: number) => String(n).padStart(2, "0");

export function wallToMs(iso: string): number {
  const y = +iso.slice(0, 4), mo = +iso.slice(5, 7), d = +iso.slice(8, 10);
  const H = +(iso.slice(11, 13) || 0), M = +(iso.slice(14, 16) || 0), S = +(iso.slice(17, 19) || 0);
  return Date.UTC(y, mo - 1, d, H, M, S);
}

export function msToWall(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function wall(y: number, mo: number, d: number, H = 0, M = 0, S = 0): string {
  return msToWall(Date.UTC(y, mo - 1, d, H, M, S));
}

export function addDays(iso: string, n: number): string {
  return msToWall(wallToMs(iso) + n * 86_400_000);
}

export function addMinutes(iso: string, n: number): string {
  return msToWall(wallToMs(iso) + n * 60_000);
}

export function minutesBetween(a: string, b: string): number {
  return (wallToMs(b) - wallToMs(a)) / 60_000;
}

/** Wall-clock parts of an instant in a time zone. */
function zoneParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(ms));
  const g = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: g("year"), mo: g("month"), d: g("day"), H: g("hour") % 24, M: g("minute"), S: g("second") };
}

export function instantToParis(ms: number): string {
  const p = zoneParts(ms, "Europe/Paris");
  return wall(p.y, p.mo, p.d, p.H, p.M, p.S);
}

export function nowParis(): string {
  return instantToParis(Date.now());
}

export function nowUtcIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Convert a wall-clock time expressed in `tz` to Paris wall-clock. Unknown zones are assumed to be Paris. */
export function zonedToParis(wallIso: string, tz: string | null | undefined): string {
  if (!tz || tz === "Europe/Paris") return wallIso;
  try {
    const guess = wallToMs(wallIso);
    const p = zoneParts(guess, tz);
    const offset = Date.UTC(p.y, p.mo - 1, p.d, p.H, p.M, p.S) - guess;
    return instantToParis(guess - offset);
  } catch {
    return wallIso;
  }
}

export const FR_MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, fevrier: 2, fevr: 2, fev: 2, feb: 2, mars: 3, mar: 3, avril: 4, avr: 4, apr: 4,
  mai: 5, may: 5, juin: 6, jun: 6, juillet: 7, juil: 7, jul: 7, aout: 8, aug: 8, septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12, january: 1, february: 2, march: 3,
  april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function monthFromName(s: string): number | null {
  const k = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").trim();
  return FR_MONTHS[k] ?? null;
}
