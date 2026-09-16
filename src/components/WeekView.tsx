import { useMemo } from "react";
import { useApp } from "../ctx";
import { WEEKDAYS, WEEKDAYS_SHORT, addDays, fmtShort, hhmm, isoDate, minutesOf, parisNowIso, sameDay } from "../lib/dates";
import { navigate } from "../lib/router";
import type { MathEvent, PersonalEvent } from "../types";
import { EventRow, PERSONAL_KINDS, PersonalCard, TimelineCard, isBanner, layoutColumns } from "./EventCard";

const HOUR = 52;

export default function WeekView({ monday, events, personal, onOpenPersonal }: {
  monday: Date; events: MathEvent[]; personal: PersonalEvent[]; onOpenPersonal: (p: PersonalEvent) => void;
}) {
  const { prefs, openEvent } = useApp();
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekendBusy = [5, 6].some((i) => {
    const d = isoDate(allDays[i]);
    return events.some((e) => sameDay(e.start, d) && !isBanner(e)) || personal.some((p) => sameDay(p.start, d));
  });
  const days = weekendBusy ? allDays : allDays.slice(0, 5);
  const today = parisNowIso().slice(0, 10);

  const perDay = useMemo(() => days.map((d) => {
    const k = isoDate(d);
    const timed = events.filter((e) => !isBanner(e) && sameDay(e.start, k));
    const banners = events.filter((e) => isBanner(e) && e.start.slice(0, 10) <= k && (e.end ?? e.start).slice(0, 10) >= k);
    const pt = personal.filter((p) => sameDay(p.start, k));
    const mass = timed.reduce((a, e) => a + e.relevance.score, 0);
    const high = timed.filter((e) => e.relevance.tier === "high").length;
    return { d, k, timed, banners, pt, mass, high };
  }), [days, events, personal]);
  const maxMass = Math.max(1, ...perDay.map((x) => x.mass));

  let startHour = prefs?.day_start_hour ?? 8;
  let endHour = prefs?.day_end_hour ?? 20;
  for (const x of perDay) for (const e of [...x.timed, ...x.pt]) {
    startHour = Math.min(startHour, Math.floor(minutesOf(e.start) / 60));
    endHour = Math.max(endHour, Math.ceil((e.end && sameDay(e.start, e.end) ? minutesOf(e.end) : minutesOf(e.start) + 60) / 60));
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hasBanners = perDay.some((x) => x.banners.length > 0);
  const style = { "--days": days.length } as React.CSSProperties;

  return (
    <>
      <div className="week" style={style}>
        <div className="week-head">
          <div />
          {perDay.map((x) => (
            <div key={x.k} className={`week-day-head ${x.k === today ? "today" : ""}`} onClick={() => navigate(`day/${x.k}`)}
              title={`${x.timed.length} event(s), ${x.high} highly relevant`}>
              <div className="wd">{WEEKDAYS_SHORT[(x.d.getDay() + 6) % 7]}</div>
              <div className="row" style={{ alignItems: "baseline" }}>
                <span className="dn">{x.d.getDate()}</span>
                <span className="spacer" />
                <span className="tiny muted mono">{x.timed.length || ""}{x.high ? <b style={{ color: "var(--gold)" }}> ★{x.high}</b> : null}</span>
              </div>
              <div className="heat"><i style={{ width: `${(100 * x.mass) / maxMass}%` }} /></div>
            </div>
          ))}
        </div>
        {hasBanners && (
          <div className="week-allday">
            <div />
            {perDay.map((x) => (
              <div key={x.k}>
                {x.banners.slice(0, 3).map((e) => (
                  <div key={e.id} className="wa" onClick={() => openEvent(e.id)} title={e.title}>{e.title}</div>
                ))}
                {x.banners.length > 3 && <div className="tiny muted">+{x.banners.length - 3}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="week-body">
          <div className="tl-hours">
            {hours.map((h) => <div key={h} className="tl-hour" style={{ height: HOUR }}><span>{String(h).padStart(2, "0")}:00</span></div>)}
          </div>
          {perDay.map((x) => {
            const placed = layoutColumns<MathEvent | PersonalEvent>([...x.timed, ...x.pt], 40);
            return (
              <div key={x.k} className={`week-col ${x.k === today ? "today" : ""}`}>
                {hours.map((h) => <div key={h} className="tl-line" style={{ height: HOUR }} />)}
                {placed.map((p) =>
                  "relevance" in p.item ? (
                    <TimelineCard key={(p.item as MathEvent).id} p={p as never} hourPx={HOUR} startHour={startHour} onOpen={openEvent} compact />
                  ) : (
                    <PersonalCard key={`p${(p.item as PersonalEvent).id}${p.item.start}`} p={p as never} hourPx={HOUR} startHour={startHour} onOpen={onOpenPersonal} compact />
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* phone: agenda list */}
      <div className="agenda">
        {perDay.map((x) => (
          <div key={x.k}>
            <div className="date-group row" onClick={() => navigate(`day/${x.k}`)}>
              <span>{WEEKDAYS[(x.d.getDay() + 6) % 7]} {x.d.getDate()}</span>
              <span className="spacer" />
              <span className="tiny muted">{x.timed.length} event{x.timed.length === 1 ? "" : "s"}{x.high ? ` · ★ ${x.high}` : ""}</span>
            </div>
            <div className="panel" style={{ overflow: "hidden" }}>
              {x.pt.map((p) => (
                <div key={`p${p.id}${p.start}`} className="list-event" onClick={() => onOpenPersonal(p)}>
                  <div className="when">{p.all_day ? "all day" : hhmm(p.start)}</div>
                  <div><span className="badge type">{PERSONAL_KINDS[p.kind] ?? p.kind}</span> {p.title}</div>
                </div>
              ))}
              {x.timed.map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} showDate={false} />)}
              {x.banners.map((e) => (
                <div key={e.id} className="list-event" onClick={() => openEvent(e.id)}>
                  <div className="when">{e.end ? `→ ${fmtShort(e.end)}` : "all day"}</div>
                  <div className="title">{e.title}</div>
                </div>
              ))}
              {x.timed.length + x.pt.length + x.banners.length === 0 && <div className="list-event muted">No events</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
