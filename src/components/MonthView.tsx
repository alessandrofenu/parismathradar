import { useMemo } from "react";
import { useApp } from "../ctx";
import { WEEKDAYS_SHORT, addDays, hhmm, isoDate, parisNowIso, sameDay } from "../lib/dates";
import { navigate } from "../lib/router";
import type { MathEvent, PersonalEvent } from "../types";
import { Stars, primaryColor } from "./common";
import { isBanner } from "./EventCard";

export default function MonthView({ month, gridStart, events, personal }: {
  month: Date; gridStart: Date; events: MathEvent[]; personal: PersonalEvent[];
}) {
  const { topicById } = useApp();
  const today = parisNowIso().slice(0, 10);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    const k = isoDate(d);
    const timed = events.filter((e) => !isBanner(e) && sameDay(e.start, k));
    const banners = events.filter((e) => isBanner(e) && e.start.slice(0, 10) === k);
    const all = [...timed, ...banners];
    const mass = all.reduce((a, e) => a + e.relevance.score, 0);
    const top = [...all].sort((a, b) => b.relevance.score - a.relevance.score).slice(0, 3);
    const colors = Array.from(new Set(all.map((e) => primaryColor(e, topicById)))).slice(0, 6);
    const pe = personal.filter((p) => sameDay(p.start, k));
    return { d, k, all, mass, top, colors, pe, high: all.filter((e) => e.relevance.tier === "high").length };
  }), [gridStart, events, personal, topicById]);
  // hide a trailing all-other-month week
  const rows = cells.slice(35).every((c) => c.d.getMonth() !== month.getMonth()) ? cells.slice(0, 35) : cells;
  const maxMass = Math.max(150, ...rows.map((c) => c.mass));

  return (
    <div className="month">
      <div className="month-head">{WEEKDAYS_SHORT.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="month-grid">
        {rows.map((c) => {
          const other = c.d.getMonth() !== month.getMonth();
          const heat = Math.round((22 * c.mass) / maxMass);
          return (
            <div
              key={c.k}
              className={`mcell ${other ? "other" : ""} ${c.k === today ? "today" : ""}`}
              style={heat > 0 && !other ? { background: `color-mix(in srgb, var(--accent-2) ${heat}%, var(--panel))` } : undefined}
              onClick={() => navigate(`day/${c.k}`)}
              title={`${c.all.length} event(s)${c.high ? `, ${c.high} highly relevant` : ""}`}
            >
              <div className="mnum">
                <b>{c.d.getDate()}</b>
                {c.high > 0 && <span className="stars" style={{ fontSize: 10 }}>★{c.high > 1 ? c.high : ""}</span>}
                <span className="mcount">{c.all.length || ""}</span>
              </div>
              {c.colors.length > 0 && <div className="mdots">{c.colors.map((col) => <i key={col} style={{ background: col }} />)}</div>}
              {c.top.filter((e) => e.relevance.score >= 20 || c.all.length <= 2).slice(0, 2).map((e) => (
                <div key={e.id} className="mline">
                  <Stars tier={e.relevance.tier} />
                  <span className="mono tiny">{isBanner(e) ? "" : hhmm(e.start) + " "}</span>{e.title}
                </div>
              ))}
              {c.pe.slice(0, 1).map((p) => <div key={p.id + p.start} className="mpersonal">◦ {p.title}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
