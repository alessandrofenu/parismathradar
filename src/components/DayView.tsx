import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../ctx";
import { fmtShort, isoDate, minutesOf, parisNowIso, sameDay } from "../lib/dates";
import { MathText } from "../lib/math";
import type { MathEvent, PersonalEvent } from "../types";
import { Stars } from "./common";
import { PERSONAL_KINDS, PersonalCard, TimelineCard, isBanner, layoutColumns } from "./EventCard";

function useHourPx(): number {
  const [px, setPx] = useState(64);
  useEffect(() => {
    const read = () => setPx(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hour")) || 64);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return px;
}

export default function DayView({ date, events, personal, onOpenPersonal, loading }: {
  date: Date; events: MathEvent[]; personal: PersonalEvent[]; onOpenPersonal: (p: PersonalEvent) => void; loading: boolean;
}) {
  const { prefs, openEvent } = useApp();
  const hourPx = useHourPx();
  const day = isoDate(date);
  const [nowIso, setNowIso] = useState(parisNowIso());
  useEffect(() => {
    const t = window.setInterval(() => setNowIso(parisNowIso()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [allBanners, setAllBanners] = useState(false);
  const bannersAll = events.filter(isBanner).sort((a, b) => b.relevance.score - a.relevance.score);
  const banners = allBanners ? bannersAll : bannersAll.slice(0, 3);
  const timed = events.filter((e) => !isBanner(e) && sameDay(e.start, day));
  const ptimed = personal.filter((p) => !p.all_day && sameDay(p.start, day));
  const pall = personal.filter((p) => p.all_day && sameDay(p.start, day));

  const { startHour, endHour } = useMemo(() => {
    let s = prefs?.day_start_hour ?? 8;
    let e = prefs?.day_end_hour ?? 20;
    for (const x of [...timed, ...ptimed]) {
      s = Math.min(s, Math.floor(minutesOf(x.start) / 60));
      const end = x.end && sameDay(x.start, x.end) ? minutesOf(x.end) : minutesOf(x.start) + 60;
      e = Math.max(e, Math.ceil(end / 60));
    }
    return { startHour: Math.max(0, s), endHour: Math.min(24, e) };
  }, [timed, ptimed, prefs]);

  const placed = useMemo(() => layoutColumns<MathEvent | PersonalEvent>([...timed, ...ptimed]), [timed, ptimed]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const isToday = sameDay(nowIso, day);
  const nowMin = minutesOf(nowIso);

  return (
    <div>
      {(bannersAll.length > 0 || pall.length > 0) && (
        <div className="allday">
          {banners.map((e) => (
            <div key={e.id} className="allday-item" onClick={() => openEvent(e.id)} role="button" tabIndex={0}
              onKeyDown={(k) => k.key === "Enter" && openEvent(e.id)}>
              <Stars tier={e.relevance.tier} />
              <span className="badge type">{e.event_type_label}</span>
              <MathText className="grow serif" text={e.title} />
              <span className="when">
                {e.end && !sameDay(e.start, e.end) ? `${fmtShort(e.start)} → ${fmtShort(e.end)}` : "all day"}
                {e.place ? ` · ${e.place.city}` : e.institution ? ` · ${e.institution.short}` : ""}
              </span>
            </div>
          ))}
          {bannersAll.length > 3 && (
            <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAllBanners(!allBanners)}>
              {allBanners ? "Show fewer" : `+ ${bannersAll.length - 3} more ongoing`}
            </button>
          )}
          {pall.map((p) => (
            <div key={`p${p.id}${p.start}`} className="allday-item" style={{ borderLeftColor: "var(--personal)" }} onClick={() => onOpenPersonal(p)}>
              <span className="badge type">{PERSONAL_KINDS[p.kind] ?? p.kind}</span>
              <span className="grow">{p.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="timeline" ref={scrollRef}>
        <div className="tl-hours">
          {hours.map((h) => (
            <div key={h} className="tl-hour"><span>{String(h).padStart(2, "0")}:00</span></div>
          ))}
        </div>
        <div className="tl-grid">
          {hours.map((h) => <div key={h} className="tl-line half" />)}
          {startHour <= 12 && endHour >= 14 && (
            <div className="lunch" style={{ top: ((12.5 - startHour) * hourPx), height: hourPx }}><span>Lunch</span></div>
          )}
          {isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
            <div className="now-line" style={{ top: ((nowMin - startHour * 60) / 60) * hourPx }} />
          )}
          {placed.map((p) =>
            "relevance" in p.item ? (
              <TimelineCard key={(p.item as MathEvent).id} p={p as never} hourPx={hourPx} startHour={startHour} onOpen={openEvent} />
            ) : (
              <PersonalCard key={`p${(p.item as PersonalEvent).id}${p.item.start}`} p={p as never} hourPx={hourPx} startHour={startHour} onOpen={onOpenPersonal} />
            ),
          )}
          {!loading && timed.length === 0 && ptimed.length === 0 && (
            <div className="empty-day" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <h3>No talks scheduled this day</h3>
              <p>None of the monitored sources lists a timed mathematical event for this date{banners.length ? " (see the multi-day events above)" : ""}.</p>
              <p className="small">Coverage gaps are listed on the <a href="#/sources">Sources</a> page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
