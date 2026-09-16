import { useMemo } from "react";
import { useApp } from "../ctx";
import { seriesDetail } from "../data";
import { fmtShort } from "../lib/dates";
import { MathText } from "../lib/math";
import { Drawer, Unavailable } from "./common";
import { EventRow } from "./EventCard";

export default function SeriesDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ds, prefs, updatePrefs, openEvent, topicById, toast } = useApp();
  const d = useMemo(() => seriesDetail(ds, id, prefs), [ds, id, prefs]);
  if (!d) return <Drawer onClose={onClose}><p>This series is no longer in the catalogue.</p></Drawer>;
  const s = d.series;
  const followed = prefs.followed_series.includes(s.id);
  const inst = s.institution_id ? ds.institutionById.get(s.institution_id) : undefined;
  const toggle = () => {
    updatePrefs({ followed_series: followed ? prefs.followed_series.filter((x) => x !== s.id) : [...prefs.followed_series, s.id] });
    toast(followed ? "Unfollowed" : `Following ${s.name}`);
  };
  const scheduled = d.upcoming.filter((e) => e.status !== "tba" && e.status !== "no_session");
  const tba = d.upcoming.filter((e) => e.status === "tba");

  return (
    <Drawer onClose={onClose} head={<span className="caps">Seminar series</span>}>
      <div className="small muted">{inst?.name ?? s.institution_id}</div>
      <h2>{s.name}</h2>
      <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
        {s.topics.filter((t) => topicById[t]).map((t) => (
          <span key={t} className="chip"><span className="dot" style={{ background: topicById[t].color }} />{topicById[t].label}</span>
        ))}
      </div>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className={`btn ${followed ? "on" : ""}`} onClick={toggle}>{followed ? "✓ Following" : "Follow this series"}</button>
        {s.official_url && <a className="btn primary" href={s.official_url} target="_blank" rel="noreferrer">Official page ↗</a>}
        {s.calendar_url && <a className="btn" href={s.calendar_url} target="_blank" rel="noreferrer">Calendar feed ↗</a>}
      </div>
      <dl className="dl">
        <dt>Team / department</dt><dd>{s.department ?? <Unavailable />}</dd>
        <dt>Organisers</dt><dd>{s.organizers ?? <Unavailable />}</dd>
        <dt>Regular slot</dt>
        <dd>
          {s.recurrence ? (
            <>{s.recurrence}{s.statement_source && <> — <a href={s.statement_source} target="_blank" rel="noreferrer">where this is stated</a></>}</>
          ) : (
            <Unavailable>No regular slot stated by the source (not inferred from past talks).</Unavailable>
          )}
        </dd>
        <dt>Usual place</dt><dd>{s.typical_location ?? <Unavailable />}</dd>
        <dt>Mailing list</dt><dd>{s.mailing_list ? <a href={s.mailing_list} target="_blank" rel="noreferrer">{s.mailing_list}</a> : <Unavailable />}</dd>
        <dt>Announced ahead</dt><dd>{s.published_in_advance === "yes" ? "Yes — several sessions are listed in advance" : <Unavailable>Unknown</Unavailable>}</dd>
        <dt>Catalogue entry</dt><dd>{s.auto_discovered ? "Discovered automatically from its source" : "Curated during the research phase"}</dd>
      </dl>
      {s.description && (
        <div className="section">
          <span className="caps">Description (from the source)</span>
          <MathText as="div" className="abstract" text={s.description} />
        </div>
      )}
      <div className="section">
        <span className="caps">Upcoming sessions ({scheduled.length})</span>
        <div className="panel" style={{ overflow: "hidden" }}>
          {scheduled.length === 0 && <div className="list-event muted">No session with a published speaker yet.</div>}
          {scheduled.map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} />)}
        </div>
        {tba.length > 0 && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Also {tba.length} announced slot{tba.length > 1 ? "s" : ""} without speaker: {tba.slice(0, 8).map((e) => fmtShort(e.start)).join(", ")}{tba.length > 8 ? "…" : ""}
          </div>
        )}
      </div>
      {d.recent.length > 0 && (
        <div className="section">
          <span className="caps">Recent</span>
          {d.recent.map((r) => (
            <div key={r.id} className="small" style={{ padding: "3px 0", cursor: "pointer" }} onClick={() => openEvent(r.id)}>
              <span className="mono muted">{fmtShort(r.start)}</span> — <MathText text={r.title} />{r.speaker ? ` (${r.speaker})` : ""}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
