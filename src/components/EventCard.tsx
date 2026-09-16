import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import { fmtShort, hhmm, minutesOf, sameDay } from "../lib/dates";
import { MathText } from "../lib/math";
import type { MathEvent, PersonalEvent } from "../types";
import { Stars, primaryColor, travelText } from "./common";

export const PERSONAL_KINDS: Record<string, string> = {
  personal: "Personal", class: "Class", deadline: "Deadline", meeting: "Meeting", research: "Research work",
  exam: "Exam", office_hours: "Office hours",
};

export function isBanner(ev: { start: string; end: string | null; all_day: boolean }): boolean {
  if (ev.all_day) return true;
  if (ev.end && !sameDay(ev.start, ev.end)) return true;
  if (ev.end && minutesOf(ev.end) - minutesOf(ev.start) > 10 * 60) return true;
  return false;
}

export interface Placed<T> {
  item: T;
  s: number;
  e: number;
  col: number;
  cols: number;
  hasEnd: boolean;
}

/** Greedy column layout for overlapping timed items. */
export function layoutColumns<T extends { start: string; end: string | null }>(items: T[], minVisual = 50): Placed<T>[] {
  const evs = items
    .map((item) => {
      const s = minutesOf(item.start);
      const hasEnd = !!item.end && sameDay(item.start, item.end) && minutesOf(item.end) > s;
      const e = hasEnd ? minutesOf(item.end!) : s + 60;
      return { item, s, e, ve: Math.max(e, s + minVisual), col: 0, cols: 1, hasEnd };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Placed<T>[] = [];
  let cluster: typeof evs = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols: number[] = [];
    for (const x of cluster) {
      let c = cols.findIndex((end) => end <= x.s);
      if (c === -1) {
        c = cols.length;
        cols.push(x.ve);
      } else cols[c] = x.ve;
      x.col = c;
    }
    for (const x of cluster) out.push({ item: x.item, s: x.s, e: x.e, col: x.col, cols: cols.length, hasEnd: x.hasEnd });
    cluster = [];
  };
  for (const x of evs) {
    if (cluster.length && x.s >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(x);
    clusterEnd = Math.max(clusterEnd, x.ve);
  }
  flush();
  return out;
}

function placeLine(ev: MathEvent): string {
  const bits: string[] = [];
  if (ev.place) bits.push(ev.place.name.replace(/\s*\(.*?\)\s*/g, " ").trim().split(" — ")[0]);
  else if (ev.location_text) bits.push(ev.location_text);
  if (ev.room && !(ev.place && ev.location_text?.includes(ev.room) && bits[0]?.includes(ev.room))) bits.push(ev.room);
  const t = travelText(ev.place?.travel_min);
  if (t) bits.push(t);
  return bits.join(" · ");
}

export function TimelineCard({ p, hourPx, startHour, onOpen, compact = false }: {
  p: Placed<MathEvent>; hourPx: number; startHour: number; onOpen: (id: string) => void; compact?: boolean;
}) {
  const { topicById } = useApp();
  const ev = p.item;
  const top = ((p.s - startHour * 60) / 60) * hourPx;
  const height = Math.max(((Math.max(p.e, p.s + 30) - p.s) / 60) * hourPx - 3, compact ? 22 : 30);
  const width = 100 / p.cols;
  const style = {
    top, height, left: `calc(${p.col * width}% + 4px)`, width: `calc(${width}% - 8px)`,
    "--c": primaryColor(ev, topicById),
  } as CSSProperties;
  const dim = ev.status !== "scheduled" || ev.relevance.tier === "none";
  const showSpeaker = !compact && height > 68 && !!ev.speaker;
  const showSeries = !compact && height > 84 && !!ev.series_name;
  const showPlace = !compact && height > 100;
  const reserved = (compact ? 16 : 24) + (showSpeaker ? 17 : 0) + (showSeries ? 16 : 0) + (showPlace ? 16 : 0);
  const lines = Math.max(1, Math.floor((height - reserved) / (compact ? 16 : 18)));
  const narrow = compact && p.cols >= 3;
  return (
    <button
      className={`ev tier-${ev.relevance.tier} ${ev.status} ${dim ? "dim" : ""} ${compact ? "compact" : ""}`}
      style={style}
      onClick={() => onOpen(ev.id)}
      title={`${hhmm(ev.start)}${ev.end ? "–" + hhmm(ev.end) : ""} ${ev.title}${ev.speaker ? " — " + ev.speaker : ""}`}
    >
      <div className="ev-top">
        <span className="ev-time">{hhmm(ev.start)}{p.hasEnd && !compact ? `–${hhmm(ev.end)}` : ""}</span>
        {!narrow && <Stars tier={ev.relevance.tier} score={ev.relevance.score} />}
        {ev.status === "cancelled" && <span className="badge cancelled">Cancelled</span>}
        {ev.status === "tba" && <span className="badge tba">TBA</span>}
        {ev.status === "possibly_removed" && <span className="badge removed">Removed?</span>}
        {ev.changes.length > 0 && ev.status === "scheduled" && <span className="badge changed">Changed</span>}
      </div>
      <div className="ev-title" style={{ WebkitLineClamp: lines }}><MathText text={ev.title} /></div>
      {showSpeaker && (
        <div className="ev-speaker">{ev.speaker}{ev.speaker_affiliation ? ` (${ev.speaker_affiliation})` : ""}</div>
      )}
      {showSeries && <div className="ev-meta">{ev.series_name}</div>}
      {showPlace && <div className="ev-meta">{placeLine(ev) || ev.institution?.short}</div>}
    </button>
  );
}

export function PersonalCard({ p, hourPx, startHour, onOpen, compact = false }: {
  p: Placed<PersonalEvent>; hourPx: number; startHour: number; onOpen: (pe: PersonalEvent) => void; compact?: boolean;
}) {
  const pe = p.item;
  const top = ((p.s - startHour * 60) / 60) * hourPx;
  const height = Math.max(((Math.max(p.e, p.s + 30) - p.s) / 60) * hourPx - 3, compact ? 22 : 30);
  const width = 100 / p.cols;
  return (
    <button
      className={`ev personal kind-${pe.kind} ${compact ? "compact" : ""}`}
      style={{ top, height, left: `calc(${p.col * width}% + 4px)`, width: `calc(${width}% - 8px)` }}
      onClick={() => onOpen(pe)}
    >
      <div className="ev-top">
        <span className="ev-time">{hhmm(pe.start)}{pe.end && !compact ? `–${hhmm(pe.end)}` : ""}</span>
        <span>{PERSONAL_KINDS[pe.kind] ?? pe.kind}</span>
      </div>
      <div className="ev-title">{pe.title}</div>
      {!compact && height > 58 && pe.location && <div className="ev-meta">{pe.location}</div>}
    </button>
  );
}

/** Row used in lists (search, series, researcher, agenda). */
export function EventRow({ ev, onOpen, showDate = true }: { ev: MathEvent; onOpen: (id: string) => void; showDate?: boolean }) {
  const { topicById } = useApp();
  return (
    <div className="list-event" onClick={() => onOpen(ev.id)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(ev.id)}
      style={{ borderLeft: `3px solid ${primaryColor(ev, topicById)}` }}>
      <div className="when">
        {showDate && <div>{fmtShort(ev.start)}</div>}
        <div>{isBanner(ev) ? (ev.end && !sameDay(ev.start, ev.end) ? `→ ${fmtShort(ev.end)}` : "all day") : `${hhmm(ev.start)}${ev.end ? "–" + hhmm(ev.end) : ""}`}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <Stars tier={ev.relevance.tier} score={ev.relevance.score} />
          {ev.status === "cancelled" && <span className="badge cancelled">Cancelled</span>}
          {ev.status === "tba" && <span className="badge tba">TBA</span>}
          <span className="badge type">{ev.event_type_label}</span>
        </div>
        <MathText className="title" text={ev.title} as="div" />
        <div className="small" style={{ color: "var(--ink-2)" }}>
          {ev.speaker ?? ""}{ev.speaker_affiliation ? ` (${ev.speaker_affiliation})` : ""}
        </div>
        <div className="small muted">{[ev.series_name, ev.institution?.short].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="small muted" style={{ textAlign: "right", maxWidth: 190 }}>
        {placeLine(ev) || ev.location_text || ""}
      </div>
    </div>
  );
}
