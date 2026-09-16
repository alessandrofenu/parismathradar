// Text helpers shared by the ingestion pipeline and the web app.

/** Lowercase, strip accents, normalise quotes/dashes, collapse whitespace — for matching only. */
export function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const PLACEHOLDER_RE =
  /^\s*(tba|tbd|à venir|a venir|titre à venir|titre a venir|titres à venir|titre bientôt disponible|titre bientot disponible|title not yet announced|to be announced|\?|-)\s*\.?\s*$/i;

export function isPlaceholder(s: string | null | undefined): boolean {
  return !s || PLACEHOLDER_RE.test(s);
}

export const NO_SESSION_RE = /\b(no seminar|pas de s[ée]minaire|relâche|relache|vacances|holidays?)\b/i;
export const CANCEL_RE = /(^|[^\p{L}])(annul[ée]e?s?|cancel+ed|canceled|cancelled|report[ée]e?|postponed)($|[^\p{L}])/iu;
