// Polite HTTP client, HTML-to-text and small helpers for the ingestion pipeline (Node ≥ 20).

import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const CONTACT = process.env.MATHRADAR_CONTACT ?? "https://github.com/";
export const USER_AGENT = `Mozilla/5.0 (compatible; ParisMathRadar/0.2; +${CONTACT}; academic calendar, low-frequency polite crawler)`;

export interface Fetched {
  url: string;
  status: number;
  text: string;
  headers: Headers;
  lastModified: string | null;
}

const lastHit = new Map<string, number>();
const MIN_DELAY_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpGet(
  url: string,
  opts: { params?: Record<string, string | number>; method?: "GET" | "POST"; form?: Record<string, string>; retries?: number; timeoutMs?: number } = {},
): Promise<Fetched> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, String(v));
  const host = u.host;
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = (lastHit.get(host) ?? 0) + MIN_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      const res = await fetch(u, {
        method: opts.method ?? "GET",
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "fr,en;q=0.8",
          ...(opts.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: opts.form ? new URLSearchParams(opts.form).toString() : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      });
      if (res.status >= 500 && attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return { url: res.url, status: res.status, text: await res.text(), headers: res.headers, lastModified: res.headers.get("last-modified") };
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`GET ${u} failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export function looksLikeBotWall(text: string): boolean {
  const t = text.slice(0, 4000).toLowerCase();
  return t.includes("/.within.website/") || t.includes("making sure you're not a bot") || t.includes("making sure you&#39;re not a bot")
    || t.includes("pas un robot") || t.includes("cf-challenge") || t.includes("just a moment...");
}

export function cleanWs(s: string | null | undefined): string | null {
  if (s == null) return null;
  const out = decodeEntities(s)
    .replace(/ /g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out || null;
}

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return cheerio.load(`<i>${s.replace(/</g, "&lt;")}</i>`)("i").text();
}

export function htmlToText(fragment: string | null | undefined): string | null {
  if (!fragment) return null;
  const $ = cheerio.load(`<div id="__root">${fragment}</div>`);
  $("script, style").remove();
  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, tr").each((_, el) => {
    $(el).after("\n");
  });
  return cleanWs($("#__root").text());
}

export function sha(...parts: unknown[]): string {
  return createHash("sha1").update(parts.map((p) => (p == null ? "" : String(p))).join("")).digest("hex").slice(0, 16);
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
