import { useMemo, useState } from "react";
import { useApp } from "../ctx";
import { rankedSeries, type RankedSeries } from "../data";
import { fmtShort, hhmm } from "../lib/dates";
import { TOPICS } from "../shared/taxonomy";

const ZONES: Record<string, string> = { "": "Anywhere", paris: "Paris intra-muros", "petite-couronne": "Petite couronne", "grande-couronne": "Grande couronne (Saclay, Cergy…)", unknown: "Location not stated" };
const KINDS: Record<string, string> = { "": "Any format", seminar: "Seminar", working_group: "Working / reading group", colloquium: "Colloquium", conference: "Conference / special days", doctoral_seminar: "Doctoral / junior", course: "Course" };
const FREQ: Record<string, RegExp> = { weekly: /weekly|hebdo/i, twice: /twice a month|bi-mensuel/i, monthly: /monthly|mensuel/i };

export default function DiscoverPage() {
  const { ds, prefs, updatePrefs, openSeries, topicById, toast } = useApp();
  const all = useMemo(() => rankedSeries(ds, prefs), [ds, prefs]);
  const [area, setArea] = useState("");
  const [inst, setInst] = useState("");
  const [zone, setZone] = useState("");
  const [kind, setKind] = useState("");
  const [freq, setFreq] = useState("");
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => all.filter((s) => {
    if (area && !s.allTopics.some((t) => t === area || topicById[t]?.parent === area)) return false;
    if (inst && s.institution_id !== inst) return false;
    if (zone && (s.place?.zone ?? "unknown") !== zone) return false;
    if (kind && s.kind !== kind) return false;
    if (freq && !FREQ[freq].test(s.recurrence ?? "")) return false;
    if (active && s.upcoming === 0) return false;
    if (text && !`${s.name} ${s.organizers ?? ""} ${s.department ?? ""}`.toLowerCase().includes(text.toLowerCase())) return false;
    return true;
  }), [all, area, inst, zone, kind, freq, active, text, topicById]);

  const shown = showAll ? list : list.slice(0, 20);
  const toggle = (s: RankedSeries) => {
    const on = prefs.followed_series.includes(s.id);
    updatePrefs({ followed_series: on ? prefs.followed_series.filter((x) => x !== s.id) : [...prefs.followed_series, s.id] });
    toast(on ? "Unfollowed" : `Following ${s.name}`);
  };
  const instName = (id: string | null) => (id ? ds.institutionById.get(id)?.short_name ?? id : "");

  return (
    <div className="page">
      <div className="page-head">
        <h1>Discover mathematics in Paris</h1>
        <span className="muted">{all.length} series catalogued</span>
      </div>
      <p className="lede">
        Seminar series, working groups and recurring meetings found across the Paris region, ranked for you by how well their
        subject matches your profile and how many talks they have announced. Recurrence is shown only when an official page states it.
      </p>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <input className="input" placeholder="Filter by name or organiser…" value={text} onChange={(e) => setText(e.target.value)} style={{ minWidth: 220 }} />
        <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All subjects</option>
          {TOPICS.filter((t) => t.grp === "area").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select className="input" value={inst} onChange={(e) => setInst(e.target.value)}>
          <option value="">All institutions</option>
          {ds.catalogue.institutions.map((i) => <option key={i.id} value={i.id}>{i.short_name}</option>)}
        </select>
        <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
          {Object.entries(ZONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={freq} onChange={(e) => setFreq(e.target.value)} title="Only series whose frequency is stated by a source">
          <option value="">Any frequency</option>
          <option value="weekly">Weekly (stated)</option>
          <option value="twice">Twice a month (stated)</option>
          <option value="monthly">Monthly (stated)</option>
        </select>
        <label className="row small"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> with announced talks</label>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        {!showAll && list.length > 0 && <div className="panel-head"><h3>Top {Math.min(20, list.length)} to follow</h3><span className="small muted">of {list.length} matching</span></div>}
        {shown.map((s, i) => {
          const on = prefs.followed_series.includes(s.id);
          return (
            <div key={s.id} className="series-row">
              <div className="rank">{i + 1}</div>
              <div style={{ minWidth: 0 }}>
                <div className="sname" onClick={() => openSeries(s.id)}>{s.name}</div>
                <div className="small muted">
                  {[instName(s.institution_id), KINDS[s.kind ?? ""] ?? s.kind, s.place ? `${s.place.name.split(" (")[0]} · ${s.place.city}` : s.typical_location,
                    s.recurrence?.replace(/\s*\(.*\)\s*$/, "")].filter(Boolean).join(" · ")}
                </div>
                <div className="row wrap" style={{ gap: 4, marginTop: 5 }}>
                  {s.allTopics.slice(0, 5).filter((t) => topicById[t]).map((t) => (
                    <span key={t} className="chip"><span className="dot" style={{ background: topicById[t].color }} />{topicById[t].label}</span>
                  ))}
                  {s.organizers && <span className="tiny muted" style={{ marginLeft: 4 }}>Org.: {s.organizers.slice(0, 90)}{s.organizers.length > 90 ? "…" : ""}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 150 }}>
                <div className="small">
                  {s.upcoming > 0 ? <b>{s.upcoming} upcoming</b> : <span className="muted">no talk announced</span>}
                  {s.tba_slots ? <span className="muted"> · {s.tba_slots} slots</span> : null}
                </div>
                {s.next_date && <div className="tiny muted mono">next {fmtShort(s.next_date)} {hhmm(s.next_date)}</div>}
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                  {s.official_url && <a className="btn small ghost" href={s.official_url} target="_blank" rel="noreferrer">Page ↗</a>}
                  <button className={`btn small ${on ? "on" : ""}`} onClick={() => toggle(s)}>{on ? "✓ Following" : "Follow"}</button>
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="series-row"><div /><div className="muted">No series match these filters.</div></div>}
      </div>
      {list.length > 20 && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn" onClick={() => setShowAll(!showAll)}>{showAll ? "Show top 20" : `Show all ${list.length}`}</button>
        </div>
      )}
    </div>
  );
}
