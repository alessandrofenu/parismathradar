import { useState } from "react";
import { useApp } from "../ctx";
import { downloadText, institutionsWithUpcoming } from "../data";
import { DEFAULT_PREFS } from "../shared/defaults";
import { PLACES } from "../shared/locations";
import { TOPICS } from "../shared/taxonomy";
import type { Origin } from "../shared/types";
import { exportBackup, importBackup } from "../userStore";

const LEVELS: [string, number][] = [["Off", 0], ["Low", 0.25], ["Medium", 0.55], ["High", 1]];
const nearest = (w: number) => LEVELS.reduce((best, l) => (Math.abs(l[1] - w) < Math.abs(best[1] - w) ? l : best))[1];

export default function FollowingPage() {
  const { ds, prefs, updatePrefs, openSeries, openResearcher, topicById, toast } = useApp();
  const [cats, setCats] = useState(prefs.arxiv_categories.join(", "));
  const [kws, setKws] = useState(prefs.arxiv_keywords.join("\n"));
  const institutions = institutionsWithUpcoming(ds);

  const setWeight = (id: string, w: number) => updatePrefs({ topic_weights: { ...prefs.topic_weights, [id]: w } });
  const toggleIn = (key: "followed_institutions" | "followed_topics", v: string) => {
    const arr = prefs[key];
    updatePrefs({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
  };
  const setOrigin = (idx: number, patch: Partial<Origin>) => updatePrefs({ origins: prefs.origins.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });

  const WeightRow = ({ id, sub }: { id: string; sub?: boolean }) => (
    <div className={`weight-row ${sub ? "sub" : ""}`}>
      {!sub && <span style={{ width: 8, height: 8, borderRadius: 4, background: topicById[id]?.color, display: "inline-block" }} />}
      <span className="lbl">{topicById[id]?.label}</span>
      <div className="seg mini">
        {LEVELS.map(([l, v]) => (
          <button key={l} className={nearest(prefs.topic_weights[id] ?? 0) === v ? "on" : ""} onClick={() => setWeight(id, v)}>{l}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head"><h1>Following &amp; preferences</h1></div>
      <p className="lede">Everything here changes how events are ranked, starred and recommended. It is saved in this browser only — use export/import to move it.</p>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Seminar series</h3><span className="small muted">{prefs.followed_series.length} followed · +20 relevance</span></div>
        <div className="panel-body">
          {prefs.followed_series.length === 0 && <p className="muted small">Follow series from <a href="#/discover">Discover</a> or from any event.</p>}
          <div className="row wrap" style={{ gap: 6 }}>
            {prefs.followed_series.map((sid) => (
              <span key={sid} className="chip" style={{ padding: "3px 4px 3px 10px" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); openSeries(sid); }}>✓ {ds.seriesById.get(sid)?.name ?? sid}</a>
                <button className="btn ghost small" onClick={() => updatePrefs({ followed_series: prefs.followed_series.filter((x) => x !== sid) })} aria-label="Unfollow">✕</button>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 18 }}>
        <section className="panel">
          <div className="panel-head"><h3>Institutions</h3><span className="small muted">+6 relevance</span></div>
          <div className="panel-body row wrap" style={{ gap: 5 }}>
            {institutions.map((i) => (
              <button key={i.id} className={`chip ${prefs.followed_institutions.includes(i.id) ? "on" : ""}`} title={i.name} onClick={() => toggleIn("followed_institutions", i.id)}>{i.short_name}</button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Researchers</h3><span className="small muted">+25 relevance</span></div>
          <div className="panel-body">
            {prefs.followed_researchers.length === 0 && <p className="muted small">Open a speaker from any event to follow them.</p>}
            <div className="row wrap" style={{ gap: 6 }}>
              {prefs.followed_researchers.map((rid) => (
                <span key={rid} className="chip" style={{ padding: "3px 4px 3px 10px" }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); openResearcher(rid); }}>{ds.researcherById.get(rid)?.name ?? rid}</a>
                  <button className="btn ghost small" onClick={() => updatePrefs({ followed_researchers: prefs.followed_researchers.filter((x) => x !== rid) })}>✕</button>
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Topics</h3><span className="small muted">+8 relevance</span></div>
          <div className="panel-body row wrap" style={{ gap: 5 }}>
            {TOPICS.filter((t) => t.id !== "general").map((t) => (
              <button key={t.id} className={`chip ${prefs.followed_topics.includes(t.id) ? "on" : ""}`} onClick={() => toggleIn("followed_topics", t.id)}>
                <span className="dot" style={{ background: t.color }} />{t.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Research interests</h3><span className="small muted">weights used by the relevance score</span></div>
        <div className="panel-body weights">
          {TOPICS.filter((t) => t.grp === "area").map((a) => (
            <div key={a.id}>
              <WeightRow id={a.id} />
              {TOPICS.filter((t) => t.parent === a.id).map((s) => <WeightRow key={s.id} id={s.id} sub />)}
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Starting points</h3><span className="small muted">for travel estimates · no location permission required</span></div>
        <div className="panel-body">
          {prefs.origins.map((o, idx) => (
            <div key={o.id} className="row wrap" style={{ padding: "6px 0", borderTop: idx ? "1px dashed var(--rule)" : 0 }}>
              <label className="row small"><input type="radio" name="origin" checked={prefs.default_origin === o.id} onChange={() => updatePrefs({ default_origin: o.id })} /> default</label>
              <input className="input" style={{ width: 130 }} value={o.label} onChange={(e) => setOrigin(idx, { label: e.target.value })} />
              <select className="input" value={o.lat !== null ? "__coords" : o.location_id ?? ""} onChange={(e) => {
                if (e.target.value !== "__coords") setOrigin(idx, { location_id: e.target.value || null, lat: null, lon: null });
              }}>
                <option value="">— choose a place —</option>
                <optgroup label="Campuses">{PLACES.filter((p) => p.kind === "campus").map((p) => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}</optgroup>
                <optgroup label="Stations">{PLACES.filter((p) => p.kind === "hub").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                {o.lat !== null && <option value="__coords">Coordinates {o.lat.toFixed(4)}, {o.lon?.toFixed(4)}</option>}
              </select>
              <button className="btn small" onClick={() => {
                if (!navigator.geolocation) return toast("Geolocation unavailable in this browser");
                navigator.geolocation.getCurrentPosition(
                  (pos) => { setOrigin(idx, { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5), location_id: null }); toast("Location saved in this browser"); },
                  () => toast("Location permission denied — choose a place instead"),
                );
              }}>Use current location</button>
              {prefs.origins.length > 1 && (
                <button className="btn small ghost" onClick={() => {
                  const rest = prefs.origins.filter((_, i) => i !== idx);
                  updatePrefs({ origins: rest, default_origin: prefs.default_origin === o.id ? rest[0].id : prefs.default_origin });
                }}>Remove</button>
              )}
            </div>
          ))}
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => updatePrefs({ origins: [...prefs.origins, { id: `o${Date.now()}`, label: "New place", location_id: null, lat: null, lon: null }] })}>+ Add starting point</button>
          <p className="tiny muted">Travel times are rough public-transport estimates from straight-line distance and typical access times; use the directions link for real itineraries.</p>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Math World</h3></div>
        <div className="panel-body form-grid" style={{ gridTemplateColumns: "150px minmax(0,1fr)" }}>
          <label>arXiv categories</label>
          <input className="input" value={cats} onChange={(e) => setCats(e.target.value)}
            onBlur={() => updatePrefs({ arxiv_categories: cats.split(/[,\s]+/).map((c) => c.trim()).filter(Boolean) })} />
          <label>Keywords (one per line)</label>
          <textarea className="input" rows={6} value={kws} onChange={(e) => setKws(e.target.value)}
            onBlur={() => updatePrefs({ arxiv_keywords: kws.split("\n").map((c) => c.trim()).filter(Boolean) })} />
          <span />
          <span className="tiny muted">The site collects {ds.news.arxiv_categories.join(", ")}; your categories filter within these (edit ARXIV_CATEGORIES in ingest/catalogue.ts to collect more).</span>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Calendar display</h3></div>
        <div className="panel-body row wrap">
          <label className="row small">Day starts at
            <input type="number" min={0} max={12} className="input" style={{ width: 64 }} value={prefs.day_start_hour} onChange={(e) => updatePrefs({ day_start_hour: +e.target.value })} />
          </label>
          <label className="row small">ends at
            <input type="number" min={13} max={24} className="input" style={{ width: 64 }} value={prefs.day_end_hour} onChange={(e) => updatePrefs({ day_end_hour: +e.target.value })} />
          </label>
          <label className="row small"><input type="checkbox" checked={prefs.show_placeholders} onChange={(e) => updatePrefs({ show_placeholders: e.target.checked })} /> show TBA slots</label>
          <label className="row small"><input type="checkbox" checked={prefs.show_outreach} onChange={(e) => updatePrefs({ show_outreach: e.target.checked })} /> show outreach &amp; training</label>
          <label className="row small"><input type="checkbox" checked={prefs.show_outside_region} onChange={(e) => updatePrefs({ show_outside_region: e.target.checked })} /> show events outside Île-de-France</label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Your data</h3><span className="small muted">preferences, personal events, notes — stored only in this browser</span></div>
        <div className="panel-body row wrap">
          <button className="btn" onClick={() => downloadText("paris-math-radar-backup.json", JSON.stringify(exportBackup(), null, 2), "application/json")}>Export to a file</button>
          <label className="btn">
            Import a file…
            <input type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importBackup(JSON.parse(await f.text()));
                window.location.reload();
              } catch (err) {
                toast(`Import failed: ${(err as Error).message}`);
              }
            }} />
          </label>
          <button className="btn ghost" onClick={() => {
            if (confirm("Reset interests, follows and display settings to the defaults? (personal events and notes are kept)")) updatePrefs(DEFAULT_PREFS);
          }}>Reset preferences</button>
        </div>
      </section>
    </div>
  );
}
