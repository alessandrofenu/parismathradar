import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../ctx";
import { eventsInRange, personalInRange } from "../data";
import { MONTHS, addDays, addMonths, fmtLong, isoDate, parisToday, startOfMonth, startOfWeek } from "../lib/dates";
import { navigate } from "../lib/router";
import DayView from "../components/DayView";
import WeekView from "../components/WeekView";
import MonthView from "../components/MonthView";
import FiltersButton, { loadFilters } from "../components/Filters";
import PersonalEventForm from "../components/PersonalEventForm";
import { MathWorld, Recommended, parseDayParam } from "../components/Sidebar";
import type { Filters, PersonalEvent } from "../types";

type View = "day" | "week" | "month";

export default function CalendarPage({ view, dateParam }: { view: View; dateParam?: string }) {
  const { ds, prefs, topicById, personal: personalAll } = useApp();
  const today = parisToday();
  const date = parseDayParam(dateParam, today);
  const dateKey = isoDate(date);
  const [filters, setFiltersState] = useState<Filters>(loadFilters);
  const [filterSignal, setFilterSignal] = useState(0);
  const [form, setForm] = useState<{ initial: PersonalEvent | null } | null>(null);
  const setFilters = (f: Filters) => {
    setFiltersState(f);
    try {
      localStorage.setItem("mr-filters", JSON.stringify(f));
    } catch {
      /* private mode */
    }
  };

  const { rangeStart, rangeEnd, gridStart } = useMemo(() => {
    const d = parseDayParam(dateKey, today);
    if (view === "week") {
      const s = startOfWeek(d);
      return { rangeStart: s, rangeEnd: addDays(s, 6), gridStart: s };
    }
    if (view === "month") {
      const g = startOfWeek(startOfMonth(d));
      return { rangeStart: g, rangeEnd: addDays(g, 41), gridStart: g };
    }
    return { rangeStart: d, rangeEnd: d, gridStart: d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey]);
  const start = `${isoDate(rangeStart)}T00:00:00`, end = `${isoDate(rangeEnd)}T23:59:59`;

  const events = useMemo(() => eventsInRange(ds, start, end, prefs).filter((e) => {
    if (filters.minScore && e.relevance.score < filters.minScore) return false;
    if (filters.areas.length) {
      const ids = new Set(e.topics.flatMap((t) => [t.id, topicById[t.id]?.parent ?? ""]));
      if (!filters.areas.some((a) => ids.has(a))) return false;
    }
    if (filters.institutions.length && !filters.institutions.includes(e.institution_id ?? "")) return false;
    if (filters.types.length && !filters.types.includes(e.event_type)) return false;
    return true;
  }), [ds, start, end, prefs, filters, topicById]);
  const personal = useMemo(() => (filters.showPersonal ? personalInRange(personalAll, start, end) : []), [filters.showPersonal, personalAll, start, end]);

  const go = useCallback((v: View, d: Date) => navigate(`${v}/${v === "month" ? isoDate(d).slice(0, 7) : isoDate(d)}`), []);
  const step = useCallback((dir: number) => {
    if (view === "day") go(view, addDays(date, dir));
    else if (view === "week") go(view, addDays(date, 7 * dir));
    else go(view, addMonths(date, dir));
  }, [view, date, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".drawer, .modal")) return;
      const k = e.key;
      if (k === "ArrowLeft" || k === "j") step(-1);
      else if (k === "ArrowRight" || k === "k") step(1);
      else if (k === "t") go(view, parisToday());
      else if (k === "d") go("day", date);
      else if (k === "w") go("week", date);
      else if (k === "m") go("month", date);
      else if (k === "n") setForm({ initial: null });
      else if (k === "f") setFilterSignal((x) => x + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, view, date]);

  const isCurrent = view === "day" ? dateKey === isoDate(today)
    : view === "week" ? isoDate(startOfWeek(date)) === isoDate(startOfWeek(today))
      : date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

  let title: string;
  if (view === "day") title = fmtLong(date);
  else if (view === "week") {
    const s = startOfWeek(date), e = addDays(s, 6);
    title = s.getMonth() === e.getMonth()
      ? `${s.getDate()} – ${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`
      : `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
  } else title = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  const high = events.filter((e) => e.relevance.tier === "high" && e.status === "scheduled").length;

  return (
    <div className="page">
      <div className="cal-layout">
        <main className="cal-main">
          <div className="toolbar">
            <button className="btn icon" onClick={() => step(-1)} aria-label="Previous" title="Previous (←)">‹</button>
            <button className={`btn ${isCurrent ? "on" : ""}`} onClick={() => go(view, today)} title="Today (t)">Today</button>
            <button className="btn icon" onClick={() => step(1)} aria-label="Next" title="Next (→)">›</button>
            <h1 className="date-title">
              {title}
              {view === "day" && isCurrent && <span className="today-tag">today</span>}
            </h1>
            <span className="spacer" />
            <div className="seg" role="tablist">
              {(["day", "week", "month"] as View[]).map((v) => (
                <button key={v} className={view === v ? "on" : ""} onClick={() => go(v, date)} title={`${v} view (${v[0]})`}>{v}</button>
              ))}
            </div>
            <FiltersButton filters={filters} setFilters={setFilters} openSignal={filterSignal} />
            <button className="btn" onClick={() => setForm({ initial: null })} title="New personal event (n)">+ <span className="hidden-mobile">Personal</span></button>
          </div>
          <div className="small muted" style={{ margin: "-6px 0 10px 4px" }}>
            {events.length} event{events.length === 1 ? "" : "s"}
            {high > 0 && <> · <span style={{ color: "var(--gold)" }}>★★★ {high} highly relevant</span></>}
            {" · "}sources checked {new Date(ds.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" })}
            <span className="hidden-mobile"> · press <kbd>?</kbd> for shortcuts</span>
          </div>

          {view === "day" && <DayView date={date} events={events} personal={personal} loading={false} onOpenPersonal={(p) => setForm({ initial: p })} />}
          {view === "week" && <WeekView monday={startOfWeek(date)} events={events} personal={personal} onOpenPersonal={(p) => setForm({ initial: p })} />}
          {view === "month" && <MonthView month={startOfMonth(date)} gridStart={gridStart} events={events} personal={personal} />}
        </main>

        <aside className="aside">
          <Recommended day={view === "day" ? date : today} />
          <MathWorld />
        </aside>
      </div>

      {form && <PersonalEventForm initial={form.initial} defaultDate={isoDate(view === "day" ? date : today)} onClose={() => setForm(null)} />}
    </div>
  );
}
