import { useMemo, useState } from "react";
import { useApp } from "../ctx";
import { eventsInRange, personalInRange } from "../data";
import { fmtShort, hhmm, relTime } from "../lib/dates";
import { addDays, nowParis } from "../shared/time";
import type { ResearchItem } from "../shared/types";
import { EventRow, PERSONAL_KINDS } from "../components/EventCard";

export default function ResearchPage() {
  const { ds, prefs, personal, research, saveResearchItem, deleteResearchItem, openEvent } = useApp();
  const [task, setTask] = useState("");
  const [note, setNote] = useState("");
  const [paper, setPaper] = useState({ title: "", url: "" });
  const [editingProject, setEditingProject] = useState(false);
  const [proj, setProj] = useState({ title: "", body: "" });

  const now = nowParis();
  const upcomingPersonal = useMemo(() => personalInRange(personal, now, addDays(now, 21))
    .filter((p) => ["meeting", "deadline", "research", "exam"].includes(p.kind)), [personal, now.slice(0, 13)]); // eslint-disable-line react-hooks/exhaustive-deps
  const talks = useMemo(() => eventsInRange(ds, now, addDays(now, 14), prefs)
    .filter((e) => e.relevance.tier === "high" && e.status === "scheduled").slice(0, 6), [ds, prefs, now.slice(0, 13)]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = research.find((i) => i.kind === "project");
  const tasks = research.filter((i) => i.kind === "task");
  const notes = research.filter((i) => i.kind === "note");
  const papers = research.filter((i) => i.kind === "paper");
  const recent = [...research].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 6);
  const add = (kind: ResearchItem["kind"], title: string, extra: Partial<ResearchItem> = {}) => {
    if (title.trim()) saveResearchItem({ kind, title: title.trim(), body: extra.body ?? null, url: extra.url ?? null, done: false });
  };
  const update = (it: ResearchItem, patch: Partial<ResearchItem>) => saveResearchItem({ ...it, ...patch });

  return (
    <div className="page">
      <div className="page-head"><h1>My research</h1></div>
      <p className="lede">A small notebook next to the calendar: current project, tasks, notes and papers. Stored only in this browser.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
        <section className="panel">
          <div className="panel-head"><h3>Current project</h3><span className="spacer" />
            <button className="btn small ghost" onClick={() => { setProj({ title: project?.title ?? "", body: project?.body ?? "" }); setEditingProject(true); }}>Edit</button>
          </div>
          <div className="panel-body">
            {editingProject ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (project) update(project, { title: proj.title, body: proj.body });
                else add("project", proj.title, { body: proj.body });
                setEditingProject(false);
              }}>
                <input className="input" style={{ width: "100%", marginBottom: 6 }} placeholder="Configuration spaces" value={proj.title} onChange={(e) => setProj({ ...proj, title: e.target.value })} />
                <textarea className="input" rows={4} placeholder="Goal, current question, next step…" value={proj.body} onChange={(e) => setProj({ ...proj, body: e.target.value })} />
                <div className="row" style={{ marginTop: 6 }}><span className="spacer" /><button className="btn primary small">Save</button></div>
              </form>
            ) : project ? (
              <>
                <div className="serif" style={{ fontSize: 22, fontWeight: 600 }}>{project.title}</div>
                {project.body && <p style={{ whiteSpace: "pre-line", marginBottom: 0 }}>{project.body}</p>}
              </>
            ) : (
              <p className="muted small">No project yet — click Edit to describe what you are working on.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Upcoming</h3></div>
          <div className="panel-body">
            {upcomingPersonal.map((p) => (
              <div key={`${p.id}${p.start}`} className="row small" style={{ padding: "4px 0" }}>
                <span className="mono muted" style={{ width: 96 }}>{fmtShort(p.start)} {p.all_day ? "" : hhmm(p.start)}</span>
                <span className="badge type">{PERSONAL_KINDS[p.kind] ?? p.kind}</span>
                <span>{p.title}</span>
              </div>
            ))}
            {upcomingPersonal.length === 0 && <p className="small muted">No meetings or deadlines in the next three weeks (add them from the calendar with <kbd>n</kbd>).</p>}
            <div className="caps" style={{ marginTop: 10 }}>Highly relevant talks, next 2 weeks</div>
          </div>
          <div style={{ borderTop: "1px solid var(--rule)" }}>
            {talks.map((e) => <EventRow key={e.id} ev={e} onOpen={openEvent} />)}
            {talks.length === 0 && <div className="list-event muted small">None found.</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Tasks</h3><span className="small muted">{tasks.filter((t) => !t.done).length} open</span></div>
          <div className="panel-body">
            <form className="row" onSubmit={(e) => { e.preventDefault(); add("task", task); setTask(""); }}>
              <input className="input grow" placeholder="Read Lambrechts–Stanley, §3" value={task} onChange={(e) => setTask(e.target.value)} />
              <button className="btn small">Add</button>
            </form>
            {tasks.map((t) => (
              <div key={t.id} className="row" style={{ padding: "5px 0", borderBottom: "1px dashed var(--rule)" }}>
                <input type="checkbox" checked={t.done} onChange={(e) => update(t, { done: e.target.checked })} />
                <span className="grow" style={{ textDecoration: t.done ? "line-through" : undefined, color: t.done ? "var(--ink-3)" : undefined }}>{t.title}</span>
                <button className="btn ghost small" onClick={() => deleteResearchItem(t.id)} aria-label="Delete">✕</button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Notes</h3></div>
          <div className="panel-body">
            <form onSubmit={(e) => { e.preventDefault(); add("note", note.split("\n")[0].slice(0, 80), { body: note }); setNote(""); }}>
              <textarea className="input" rows={3} placeholder="Idea, question, remark from a talk…" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row" style={{ marginTop: 4 }}><span className="spacer" /><button className="btn small">Add note</button></div>
            </form>
            {notes.map((n) => (
              <div key={n.id} style={{ padding: "7px 0", borderBottom: "1px dashed var(--rule)" }}>
                <div className="row"><span className="tiny muted">{relTime(n.created)}</span><span className="spacer" /><button className="btn ghost small" onClick={() => deleteResearchItem(n.id)}>✕</button></div>
                <div style={{ whiteSpace: "pre-line" }}>{n.body ?? n.title}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Papers</h3></div>
          <div className="panel-body">
            <form className="row wrap" onSubmit={(e) => { e.preventDefault(); add("paper", paper.title, { url: paper.url }); setPaper({ title: "", url: "" }); }}>
              <input className="input grow" placeholder="Title" value={paper.title} onChange={(e) => setPaper({ ...paper, title: e.target.value })} />
              <input className="input grow" placeholder="https://arxiv.org/abs/…" value={paper.url} onChange={(e) => setPaper({ ...paper, url: e.target.value })} />
              <button className="btn small">Add</button>
            </form>
            {papers.map((p) => (
              <div key={p.id} className="row" style={{ padding: "5px 0", borderBottom: "1px dashed var(--rule)" }}>
                <span className="grow">{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</span>
                <button className="btn ghost small" onClick={() => deleteResearchItem(p.id)}>✕</button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Recent activity</h3></div>
          <div className="panel-body">
            {recent.length === 0 && <p className="small muted">Nothing yet.</p>}
            {recent.map((r) => (
              <div key={r.id} className="small" style={{ padding: "3px 0" }}>
                <span className="muted">{relTime(r.updated)} · {r.kind}{r.kind === "task" && r.done ? " completed" : " added"}:</span> {r.title}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
