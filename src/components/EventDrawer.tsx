import { useMemo } from "react";
import { useApp } from "../ctx";
import { decorate, downloadText, eventToIcs } from "../data";
import { fmtLong, fmtShort, hhmm, parseDate, relTime, sameDay } from "../lib/dates";
import { MathText } from "../lib/math";
import { Drawer, Stars, TopicChips, Unavailable, reliabilityLabel, tierLabel } from "./common";

const FIELD_LABEL: Record<string, string> = {
  title: "Title", speaker: "Speaker", start: "Start", end: "End", room: "Room", location_text: "Location", status: "Status",
};

export default function EventDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ds, prefs, updatePrefs, openResearcher, openSeries, toast } = useApp();
  const raw = ds.eventById.get(id);
  const ev = useMemo(() => (raw ? decorate(ds, raw, prefs) : null), [ds, raw, prefs]);
  if (!ev) return <Drawer onClose={onClose}><p>This event is no longer in the data.</p></Drawer>;
  const series = ev.series_id ? ds.seriesById.get(ev.series_id) : undefined;

  const followedSeries = !!ev.series_id && prefs.followed_series.includes(ev.series_id);
  const toggleSeries = () => {
    if (!ev.series_id) return;
    updatePrefs({ followed_series: followedSeries ? prefs.followed_series.filter((s) => s !== ev.series_id) : [...prefs.followed_series, ev.series_id] });
    toast(followedSeries ? "Unfollowed series" : `Following ${ev.series_name}`);
  };
  const multiDay = !!ev.end && !sameDay(ev.start, ev.end);
  const when = ev.all_day || multiDay
    ? multiDay ? `${fmtLong(parseDate(ev.start))} → ${fmtLong(parseDate(ev.end!))}` : `${fmtLong(parseDate(ev.start))} (all day)`
    : `${fmtLong(parseDate(ev.start))}, ${hhmm(ev.start)}${ev.end ? `–${hhmm(ev.end)}` : ""}`;
  const official = ev.official_url ?? ev.sources[0]?.url ?? null;

  const head = (
    <div className="row" style={{ gap: 8, minWidth: 0 }}>
      <span className="badge type">{ev.event_type_label}</span>
      <Stars tier={ev.relevance.tier} score={ev.relevance.score} />
      <span className="small muted hidden-mobile">{ev.institution?.short}</span>
    </div>
  );

  return (
    <Drawer onClose={onClose} head={head}>
      {ev.status === "cancelled" && <div className="banner red">This event is marked as <b>cancelled</b> by its source.</div>}
      {ev.status === "possibly_removed" && (
        <div className="banner amber">This event is no longer listed on its source. It may have been cancelled or moved — check the official page.</div>
      )}
      {ev.status === "tba" && <div className="banner amber">A session is announced for this slot, but no speaker or title has been published yet.</div>}
      {ev.changes.length > 0 && (
        <div className="banner amber">
          Updated since first seen:{" "}
          {ev.changes.slice(0, 3).map((c, i) => (
            <span key={i}>{i > 0 && "; "}{FIELD_LABEL[c.field] ?? c.field} changed from “{c.old_value}” to “{c.new_value}” ({relTime(c.detected_at)})</span>
          ))}
        </div>
      )}

      {ev.series_name && (
        <div className="small" style={{ letterSpacing: "0.02em" }}>
          {series ? <a href="#" onClick={(e) => { e.preventDefault(); openSeries(series.id); }}>{ev.series_name}</a> : ev.series_name}
          {ev.institution && <span className="muted"> · {ev.institution.short}</span>}
        </div>
      )}
      <h2 className={ev.status === "cancelled" ? "strike" : ""}><MathText text={ev.title} /></h2>

      <div className="speaker-line">
        {ev.speakers.length > 0 ? (
          ev.speakers.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <a href="#" onClick={(e) => { e.preventDefault(); openResearcher(s.id); }}>{s.name}</a>
            </span>
          ))
        ) : ev.speaker ? ev.speaker : ["seminar", "colloquium", "thesis_defense"].includes(ev.event_type) ? <Unavailable>Speaker not announced</Unavailable> : null}
        {ev.speaker_affiliation && <span className="muted"> ({ev.speaker_affiliation})</span>}
      </div>

      <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
        {official && <a className="btn primary" href={official} target="_blank" rel="noreferrer">Official page ↗</a>}
        <button className="btn" onClick={() => downloadText(`${ev.id}.ics`, eventToIcs(ev), "text/calendar")}>Add to calendar (.ics)</button>
        {series && <button className={`btn ${followedSeries ? "on" : ""}`} onClick={toggleSeries}>{followedSeries ? "✓ Following series" : "Follow series"}</button>}
        {ev.online_url && <a className="btn" href={ev.online_url} target="_blank" rel="noreferrer">Online ↗</a>}
      </div>

      <dl className="dl">
        <dt>When</dt>
        <dd>
          {when}
          {!ev.all_day && !multiDay && !ev.end && <div className="small muted">End time not published by the source.</div>}
        </dd>
        <dt>Where</dt>
        <dd>
          {ev.place ? (
            <>
              <div><b>{ev.place.name}</b> <span className="muted">— {ev.place.city}</span></div>
              {ev.location_text && <div className="small">{ev.location_text}</div>}
              {!ev.location_text && ev.room && <div className="small">{ev.room}</div>}
              <div className="small muted">{ev.place.address}{ev.place.transit ? ` · ${ev.place.transit}` : ""}</div>
              <div className="small" style={{ marginTop: 2 }}>
                {ev.place.travel_min ? (
                  <>≈ {ev.place.travel_min} min from {prefs.origins.find((o) => o.id === prefs.default_origin)?.label ?? "your starting point"} <span className="muted">(rough estimate)</span></>
                ) : (
                  <span className="muted">Set a starting point in Following to see travel estimates.</span>
                )}
                {" · "}
                {ev.place.directions_url && <><a href={ev.place.directions_url} target="_blank" rel="noreferrer">Directions ↗</a>{" · "}</>}
                {ev.place.map_url && <a href={ev.place.map_url} target="_blank" rel="noreferrer">Map ↗</a>}
              </div>
              {ev.location_basis && ev.location_basis !== "source text" && <div className="tiny muted">Campus identified from: {ev.location_basis}.</div>}
            </>
          ) : ev.location_text ? (
            <>
              <div>{ev.location_text}</div>
              {ev.outside_region && <div className="small muted">Held outside Île-de-France.</div>}
            </>
          ) : (
            <Unavailable />
          )}
        </dd>
        <dt>Organiser</dt>
        <dd>{ev.organizer ?? series?.organizers ?? <Unavailable />}</dd>
        {ev.department && (<><dt>Team</dt><dd>{ev.department}</dd></>)}
        <dt>Registration</dt>
        <dd>{ev.registration_required === true ? "Required" : ev.registration_required === false ? "Not required" : <Unavailable>Not stated</Unavailable>}</dd>
      </dl>

      <div className="section why-box">
        <div className="row">
          <Stars tier={ev.relevance.tier} score={ev.relevance.score} />
          <b className="small">{tierLabel(ev.relevance.tier)}</b>
          <span className="spacer" />
          <span className="tiny muted mono">score {ev.relevance.score}/100</span>
        </div>
        <ul>{ev.relevance.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <div style={{ marginTop: 6 }}><TopicChips topics={ev.topics} max={8} /></div>
        <div className="tiny muted" style={{ marginTop: 6 }}>Computed in your browser from the title, abstract and series metadata against your topic weights.</div>
      </div>

      <div className="section">
        <span className="caps">Abstract</span>
        {ev.abstract ? <MathText as="div" className="abstract" text={ev.abstract} /> : <Unavailable>No abstract published by the source.</Unavailable>}
      </div>

      {series && (series.recurrence || series.mailing_list || series.description) && (
        <div className="section">
          <span className="caps">About the series</span>
          {series.recurrence && (
            <div className="small">
              {series.recurrence}
              {series.statement_source && <> — <a href={series.statement_source} target="_blank" rel="noreferrer">source</a></>}
            </div>
          )}
          {series.mailing_list && <div className="small">Mailing list: <a href={series.mailing_list} target="_blank" rel="noreferrer">{series.mailing_list.replace(/^https?:\/\//, "")}</a></div>}
          {series.description && <MathText as="div" className="small muted" text={series.description.slice(0, 500)} />}
        </div>
      )}

      <div className="section">
        <span className="caps">Sources ({ev.sources.length})</span>
        {ev.sources.map((s) => (
          <div key={s.id} className="src-row">
            <div style={{ minWidth: 0 }}>
              <div>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</div>
              <div className="tiny muted">{s.method}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={`badge rel-${s.reliability}`}>{reliabilityLabel(s.reliability)}</span>
              <div className="tiny muted">seen {relTime(s.last_seen)}</div>
            </div>
          </div>
        ))}
        <div className="tiny muted" style={{ marginTop: 6 }}>
          Confidence: {reliabilityLabel(ev.confidence)} · first seen {fmtShort(ev.first_seen.slice(0, 10))} · last verified {relTime(ev.last_verified)}
          {ev.sources.length > 1 && " · merged from several sources"}
        </div>
      </div>
    </Drawer>
  );
}
