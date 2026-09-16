import { useMemo, useState } from "react";
import { useApp } from "../ctx";
import { researcherDetail } from "../data";
import { Drawer, Unavailable } from "./common";
import { EventRow } from "./EventCard";

export default function ResearcherDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ds, prefs, updatePrefs, openEvent, toast, homepages, setHomepage } = useApp();
  const d = useMemo(() => researcherDetail(ds, id, prefs), [ds, id, prefs]);
  const [hp, setHp] = useState("");
  if (!d) return <Drawer onClose={onClose}><p>This researcher is no longer in the data.</p></Drawer>;
  const r = d.researcher;
  const homepage = r.homepage ?? homepages[r.id] ?? null;
  const followed = prefs.followed_researchers.includes(r.id);
  const toggle = () => {
    updatePrefs({ followed_researchers: followed ? prefs.followed_researchers.filter((x) => x !== r.id) : [...prefs.followed_researchers, r.id] });
    toast(followed ? `Unfollowed ${r.name}` : `Following ${r.name}`);
  };

  return (
    <Drawer onClose={onClose} head={<span className="caps">Researcher</span>}>
      <h2>{r.name}</h2>
      <div className="speaker-line">{r.affiliation ?? <Unavailable>Affiliation not stated by the sources</Unavailable>}</div>
      <div className="tiny muted">Affiliation as written on the most recent seminar announcement — not a verified biography.</div>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className={`btn ${followed ? "on" : ""}`} onClick={toggle}>{followed ? "✓ Following" : "Follow"}</button>
        {homepage && <a className="btn" href={homepage} target="_blank" rel="noreferrer">Personal page ↗</a>}
        <a className="btn" href={d.arxivSearchUrl} target="_blank" rel="noreferrer">arXiv papers ↗</a>
        <a className="btn" href={d.zbmathSearchUrl} target="_blank" rel="noreferrer">zbMATH ↗</a>
      </div>

      <dl className="dl">
        <dt>Personal page</dt>
        <dd>
          {homepage ? (
            <>
              <a href={homepage} target="_blank" rel="noreferrer">{homepage}</a>
              <div className="tiny muted">{r.homepage ? "Linked by the seminar page." : "Added by you (stored in this browser)."}</div>
            </>
          ) : (
            <>
              <Unavailable>Not provided by any source.</Unavailable>
              <form className="row" style={{ marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); if (hp.trim()) setHomepage(r.id, hp.trim()); }}>
                <input className="input grow" placeholder="Add it yourself (https://…)" value={hp} onChange={(e) => setHp(e.target.value)} />
                <button className="btn small">Save</button>
              </form>
            </>
          )}
        </dd>
        <dt>Research interests</dt>
        <dd><Unavailable>Not recorded (no biographies are generated).</Unavailable></dd>
      </dl>

      <div className="section">
        <span className="caps">Upcoming talks in Paris ({d.upcoming.length})</span>
        <div className="panel" style={{ overflow: "hidden" }}>
          {d.upcoming.length === 0 && <div className="list-event muted">None listed.</div>}
          {d.upcoming.map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} />)}
        </div>
      </div>
      {d.past.length > 0 && (
        <div className="section">
          <span className="caps">Recent talks</span>
          <div className="panel" style={{ overflow: "hidden" }}>
            {d.past.slice(-5).reverse().map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} />)}
          </div>
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: 16 }}>The arXiv and zbMATH buttons search by name — homonyms are possible.</p>
    </Drawer>
  );
}
