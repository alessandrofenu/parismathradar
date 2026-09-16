import { Fragment, useMemo, useState } from "react";
import { useApp } from "../ctx";
import { fmtShort, relTime } from "../lib/dates";
import { nowParis } from "../shared/time";
import { StatusDot, reliabilityLabel } from "../components/common";

const REPO_URL = (import.meta.env.VITE_REPO_URL as string | undefined)?.replace(/\/$/, "");

export default function SourcesPage() {
  const { ds, openEvent } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const sources = ds.catalogue.sources;

  const upcomingBySource = useMemo(() => {
    const now = nowParis();
    const m = new Map<string, number>();
    for (const e of ds.events) if (e.start >= now) for (const s of e.sources) m.set(s.id, (m.get(s.id) ?? 0) + 1);
    return m;
  }, [ds]);
  const stats = useMemo(() => {
    const now = nowParis();
    return {
      upcoming: ds.events.filter((e) => e.start >= now).length,
      multi: ds.events.filter((e) => e.sources.length > 1).length,
      series: ds.catalogue.series.length,
    };
  }, [ds]);
  const counts = sources.reduce<Record<string, number>>((a, s) => ((a[s.status] = (a[s.status] ?? 0) + 1), a), {});
  const inst = (id: string | null) => (id ? ds.institutionById.get(id)?.short_name ?? id : "");
  const shown = sources
    .filter((s) => !statusFilter || s.status === statusFilter)
    .sort((a, b) => inst(a.institution_id).localeCompare(inst(b.institution_id)) || a.name.localeCompare(b.name));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Source catalogue</h1>
        <span className="spacer" />
        {REPO_URL && <a className="btn primary" href={`${REPO_URL}/actions/workflows/update-data.yml`} target="_blank" rel="noreferrer">Refresh data (GitHub Actions) ↗</a>}
      </div>
      <p className="lede">
        Every place the calendar reads from, with the result of its last automatic check ({relTime(ds.generatedAt)}). Sources that cannot be read
        automatically are listed too, so you can see exactly where the calendar may be incomplete. Data is refreshed by a scheduled job
        {REPO_URL ? "" : " (run npm run ingest locally)"}.
      </p>

      <div className="stat-tiles">
        <div className="stat"><div className="v">{stats.upcoming}</div><div className="l">upcoming events</div></div>
        <div className="stat"><div className="v">{stats.series}</div><div className="l">seminar series</div></div>
        <div className="stat"><div className="v">{sources.length}</div><div className="l">sources catalogued</div></div>
        <div className="stat"><div className="v">{stats.multi}</div><div className="l">events confirmed by ≥ 2 sources</div></div>
        <div className="stat"><div className="v">{ds.catalogue.recent_changes.length}</div><div className="l">recent detected changes</div></div>
      </div>

      <div className="row wrap" style={{ marginBottom: 10 }}>
        <button className={`chip ${statusFilter === "" ? "on" : ""}`} onClick={() => setStatusFilter("")}>All ({sources.length})</button>
        {Object.entries(counts).map(([st, n]) => (
          <button key={st} className={`chip ${statusFilter === st ? "on" : ""}`} onClick={() => setStatusFilter(statusFilter === st ? "" : st)}>
            <StatusDot status={st} /> {n}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Source</th><th>Institution</th><th>Status</th><th>Last check</th><th>Upcoming</th><th className="hidden-mobile">Method</th><th className="hidden-mobile">Reliability</th></tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <Fragment key={s.id}>
                <tr className="clickable" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <td style={{ maxWidth: 380 }}>
                    <div>{s.name}</div>
                    <div className="tiny muted mono">{s.id}</div>
                  </td>
                  <td>{inst(s.institution_id)}</td>
                  <td><StatusDot status={s.status} /></td>
                  <td className="small" title={s.last_check ?? ""}>{relTime(s.last_check)}</td>
                  <td className="mono">{s.adapter ? upcomingBySource.get(s.id) ?? 0 : "—"}</td>
                  <td className="small hidden-mobile" style={{ maxWidth: 260 }}>{s.extraction_method}</td>
                  <td className="hidden-mobile"><span className={`badge rel-${s.reliability}`}>{reliabilityLabel(s.reliability)}</span></td>
                </tr>
                {(expanded === s.id || (s.last_error && ["error", "blocked", "stale"].includes(s.status))) && (
                  <tr>
                    <td colSpan={7} style={{ background: "var(--paper-2)" }}>
                      <div className="small">
                        {s.last_error && <div style={{ color: s.status === "error" ? "var(--red)" : "var(--ink-2)" }}>{s.last_error}</div>}
                        {expanded === s.id && (
                          <>
                            {s.notes && <div style={{ marginTop: 4 }}>{s.notes}</div>}
                            <div className="muted" style={{ marginTop: 4 }}>
                              <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
                              {s.calendar_url && <> · feed: <span className="mono tiny">{s.calendar_url}</span></>}
                              {" · "}update: {s.update_frequency ?? "—"} · extracted {s.events_found ?? 0} records
                              {s.last_duration_ms != null && ` in ${(s.last_duration_ms / 1000).toFixed(1)} s`}
                            </div>
                            {s.adapter && <div className="muted tiny mono" style={{ marginTop: 4 }}>npm run ingest -- --source {s.id}</div>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18, marginTop: 22 }}>
        <section className="panel">
          <div className="panel-head"><h3>Math World feeds</h3></div>
          <div className="panel-body">
            {ds.news.feeds.map((n) => (
              <div key={n.id} className="src-row">
                <div><a href={n.url} target="_blank" rel="noreferrer">{n.name}</a>{n.last_error && <div className="tiny muted">{n.last_error}</div>}</div>
                <div style={{ textAlign: "right" }}><StatusDot status={n.status} /><div className="tiny muted">{n.items_found ?? 0} items · {relTime(n.last_check)}</div></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Recently detected changes</h3><span className="small muted">speaker, room, time, status…</span></div>
          <div className="panel-body">
            {ds.catalogue.recent_changes.length === 0 && <p className="small muted">No change detected yet. Changes appear when a source modifies an event between two checks.</p>}
            {ds.catalogue.recent_changes.map((c, i) => {
              const ev = ds.eventById.get(c.event_id);
              return (
                <div key={i} className="src-row" style={{ cursor: "pointer" }} onClick={() => openEvent(c.event_id)}>
                  <div>
                    <div className="small"><b>{c.field}</b>: “{c.old_value}” → “{c.new_value}”</div>
                    {ev && <div className="tiny muted">{ev.title} · {fmtShort(ev.start)}</div>}
                  </div>
                  <div className="tiny muted">{relTime(c.detected_at)}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
