import { useEffect, useMemo, useState } from "react";
import { useApp } from "../ctx";
import { mathWorld, recommendations, upcomingHighlyRelevant } from "../data";
import { fmtLong, fmtShort, hhmm, isoDate, parisNowIso, parseDate } from "../lib/dates";
import { MathText } from "../lib/math";
import { Stars, tierLabel, travelText } from "./common";

export function Recommended({ day }: { day: Date }) {
  const { ds, prefs, openEvent } = useApp();
  const d = isoDate(day);
  const recs = useMemo(() => recommendations(ds, d, prefs), [ds, d, prefs]);
  const nextOnes = useMemo(() => (recs.length ? [] : upcomingHighlyRelevant(ds, d, prefs)), [ds, d, prefs, recs.length]);
  const isToday = parisNowIso().slice(0, 10) === d;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{isToday ? "What should I attend today?" : "Recommended that day"}</h3>
      </div>
      <div className="panel-body">
        {recs.length === 0 && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Nothing matching your interests on {isToday ? "today's" : `${fmtLong(day)}'s`} programme.
            </p>
            {nextOnes.length > 0 && <div className="caps" style={{ marginBottom: 2 }}>Next highly relevant</div>}
            {nextOnes.map((e) => (
              <div key={e.id} className="rec-item" onClick={() => openEvent(e.id)}>
                <div className="t" style={{ fontSize: 11.5 }}>{fmtShort(e.start)}<br />{hhmm(e.start)}</div>
                <div>
                  <MathText className="title" text={e.title} as="div" />
                  <div className="small muted">{e.speaker ?? e.series_name}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {recs.map((e) => (
          <div key={e.id} className="rec-item" onClick={() => openEvent(e.id)} role="button" tabIndex={0}
            onKeyDown={(k) => k.key === "Enter" && openEvent(e.id)}>
            <div className="t">{e.all_day ? "—" : hhmm(e.start)}</div>
            <div style={{ minWidth: 0 }}>
              <MathText className="title" text={e.title} as="div" />
              {e.speaker && <div className="small" style={{ color: "var(--ink-2)" }}>{e.speaker}</div>}
              <div className="small muted">
                {[e.place?.name.split(" (")[0] ?? e.location_text ?? null, travelText(e.place?.travel_min)].filter(Boolean).join(" · ") || e.institution?.short}
              </div>
              <div className="row small" style={{ marginTop: 3, gap: 6 }}>
                <Stars tier={e.relevance.tier} score={e.relevance.score} />
                <span style={{ color: "var(--gold)" }}>{tierLabel(e.relevance.tier)}</span>
              </div>
              <div className="why"><b>Why:</b> {e.relevance.reasons.slice(0, 2).join("; ")}.</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const dateOf = (utc: string | null) => (utc ? fmtShort(utc.slice(0, 10)) : "");

export function MathWorld() {
  const { ds, prefs, openEvent } = useApp();
  const data = useMemo(() => mathWorld(ds, prefs), [ds, prefs]);
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1100px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const body = (
    <div className="panel-body">
      {data.gatherings.length > 0 && (
        <div className="mw-section">
          <div className="caps">Coming up in Paris</div>
          {data.gatherings.map((g) => (
            <div key={g.id} className="mw-item" style={{ cursor: "pointer" }} onClick={() => openEvent(g.id)}>
              <MathText className="mw-title" text={g.title} as="div" />
              <div className="mw-meta">
                {fmtShort(g.start)}{g.end && g.end.slice(0, 10) !== g.start.slice(0, 10) ? ` → ${fmtShort(g.end)}` : ""} · {g.event_type_label}
                {g.place ? ` · ${g.place.city}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {data.news.length > 0 && (
        <div className="mw-section">
          <div className="caps">News</div>
          {data.news.map((n) => (
            <div key={n.id} className="mw-item">
              <a className="mw-title" href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              {n.summary && <div className="mw-sum">{n.summary}</div>}
              <div className="mw-meta">{dateOf(n.published)} · {n.source}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mw-section">
        <div className="caps">New on arXiv for you</div>
        {data.arxiv.length === 0 && <p className="small muted">No recent listing matches your keywords ({data.arxivTotal} entries checked).</p>}
        {data.arxiv.map((a) => (
          <div key={a.id} className="mw-item">
            <a className="mw-title" href={a.url} target="_blank" rel="noreferrer"><MathText text={a.title} /></a>
            <div className="mw-meta">{a.authors?.split(",").slice(0, 3).join(", ")}{(a.authors?.split(",").length ?? 0) > 3 ? " et al." : ""}</div>
            {a.summary && <MathText className="mw-sum" text={a.summary} as="div" />}
            <div className="mw-meta">{a.source} · {dateOf(a.published)} · matches: {a.matches.join(", ")}</div>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        Summaries are excerpts from each source (never generated). Feeds: {data.feeds.map((f) => f.name.split(" — ")[0].split(" (")[0]).join(", ")}.
      </p>
    </div>
  );

  if (narrow) {
    return (
      <details className="panel collapsible">
        <summary className="panel-head"><h3>Math World</h3><span className="spacer" /><span className="small muted">tap to expand</span></summary>
        {body}
      </details>
    );
  }
  return (
    <section className="panel">
      <div className="panel-head"><h3>Math World</h3><span className="small muted">recent &amp; notable</span></div>
      {body}
    </section>
  );
}

export function parseDayParam(s: string | undefined, fallback: Date): Date {
  return s && /^\d{4}-\d{2}(-\d{2})?$/.test(s) ? parseDate(s.length === 7 ? `${s}-01` : s) : fallback;
}
