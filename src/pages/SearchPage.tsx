import { useMemo, useState } from "react";
import { useApp } from "../ctx";
import { searchEvents, type MathEvent } from "../data";
import { WEEKDAYS, fmtLong, parseDate } from "../lib/dates";
import { PLACE_BY_ID } from "../shared/locations";
import { EventRow } from "../components/EventCard";

export default function SearchPage({ q }: { q: string }) {
  const { ds, prefs, openEvent, openSeries, openResearcher, topicById } = useApp();
  const [past, setPast] = useState(false);
  const data = useMemo(() => (q ? searchEvents(ds, q, prefs, past) : null), [ds, q, prefs, past]);
  const shownEvents = data?.events.slice(0, 150) ?? [];

  const groups: [string, MathEvent[]][] = [];
  for (const e of shownEvents) {
    const d = e.start.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last[0] === d) last[1].push(e);
    else groups.push([d, [e]]);
  }
  const it = data?.spec;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Search</h1>
        <span className="serif" style={{ fontSize: 20, color: "var(--ink-2)" }}>“{q}”</span>
      </div>
      {it && (
        <div className="row wrap small" style={{ margin: "6px 0 14px", gap: 6 }}>
          <span className="muted">Understood as:</span>
          {it.text.length > 0 && <span className="chip">text: {it.text.join(" ")}</span>}
          {it.topics.map((t) => <span key={t} className="chip"><span className="dot" style={{ background: topicById[t]?.color }} />topic: {topicById[t]?.label ?? t} (or text)</span>)}
          {it.weekday !== null && <span className="chip">{WEEKDAYS[it.weekday]}s</span>}
          {it.range && <span className="chip">{it.range[0]} → {it.range[1]}</span>}
          {it.places.length > 0 && <span className="chip">at {it.places.map((p) => PLACE_BY_ID[p]?.name.split(" (")[0] ?? p).join(" / ")}</span>}
          {it.institutions.length > 0 && <span className="chip">institution: {it.institutions.join(", ")}</span>}
          <span className="spacer" />
          <label className="row"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} /> include past events</label>
        </div>
      )}

      {data && (data.series.length > 0 || data.researchers.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 16 }}>
          {data.series.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Seminar series</h3></div>
              <div className="panel-body">
                {data.series.map((s) => (
                  <div key={s.id} style={{ padding: "4px 0" }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); openSeries(s.id); }}>{s.name}</a>
                    {s.organizers && <div className="tiny muted">Organisers: {s.organizers}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}
          {data.researchers.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h3>Speakers</h3></div>
              <div className="panel-body">
                {data.researchers.map((r) => (
                  <div key={r.id} style={{ padding: "4px 0" }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); openResearcher(r.id); }}>{r.name}</a>
                    {r.affiliation && <span className="small muted"> — {r.affiliation}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="small muted" style={{ marginBottom: 6 }}>
            {data.events.length} event{data.events.length === 1 ? "" : "s"}{data.events.length > shownEvents.length ? ` (showing ${shownEvents.length})` : ""}
          </div>
          {data.events.length === 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <p style={{ margin: 0 }}>No {past ? "" : "upcoming "}event matches.</p>
              {!past && <p className="small muted">Try including past events, or a broader word (e.g. “homotopy” instead of a full title).</p>}
            </div>
          )}
          {groups.map(([d, evs]) => (
            <div key={d}>
              <div className="date-group">{fmtLong(parseDate(d))}</div>
              <div className="panel" style={{ overflow: "hidden" }}>
                {evs.map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} showDate={false} />)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
