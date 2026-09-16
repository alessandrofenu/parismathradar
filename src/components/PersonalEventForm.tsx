import { useState } from "react";
import { useApp } from "../ctx";
import type { PersonalEvent } from "../shared/types";
import { Modal } from "./common";
import { PERSONAL_KINDS } from "./EventCard";

export default function PersonalEventForm({ initial, defaultDate, onClose }: { initial: PersonalEvent | null; defaultDate: string; onClose: () => void }) {
  const { personal, savePersonalItem, deletePersonalItem, toast } = useApp();
  const id = initial?.occurrence_of ?? initial?.id;
  const original = id ? personal.find((p) => p.id === id) ?? initial : null; // edit the series, not the occurrence
  const [title, setTitle] = useState(original?.title ?? "");
  const [kind, setKind] = useState(original?.kind ?? "personal");
  const [date, setDate] = useState((original?.start ?? defaultDate).slice(0, 10));
  const [start, setStart] = useState(original ? original.start.slice(11, 16) : "10:00");
  const [end, setEnd] = useState(original?.end ? original.end.slice(11, 16) : "11:00");
  const [allDay, setAllDay] = useState(!!original?.all_day);
  const [location, setLocation] = useState(original?.location ?? "");
  const [notes, setNotes] = useState(original?.notes ?? "");
  const [weekly, setWeekly] = useState(original?.weekly_until ?? "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    savePersonalItem({
      id: id ?? undefined, title: title.trim(), kind, all_day: allDay, location: location || null, notes: notes || null,
      start: `${date}T${allDay ? "00:00" : start}:00`, end: allDay ? null : `${date}T${end}:00`, weekly_until: weekly || null,
    });
    toast("Saved in this browser");
    onClose();
  };
  const remove = () => {
    if (!id || !confirm("Delete this personal event (all its repetitions)?")) return;
    deletePersonalItem(id);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={save}>
        <h3>{id ? "Edit personal event" : "New personal event"}</h3>
        <div className="form-grid">
          <label htmlFor="pe-title">Title</label>
          <input id="pe-title" className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting with supervisor" />
          <label htmlFor="pe-kind">Kind</label>
          <select id="pe-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(PERSONAL_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label htmlFor="pe-date">{weekly ? "First date" : "Date"}</label>
          <input id="pe-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <label>Time</label>
          <div className="row wrap">
            <label className="row small"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day</label>
            {!allDay && (
              <>
                <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
                <span>–</span>
                <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
              </>
            )}
          </div>
          <label htmlFor="pe-loc">Location</label>
          <input id="pe-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sophie Germain, 2015" />
          <label htmlFor="pe-weekly">Repeat weekly until</label>
          <input id="pe-weekly" type="date" className="input" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
          <label htmlFor="pe-notes">Notes</label>
          <textarea id="pe-notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="tiny muted" style={{ marginTop: -4 }}>Personal events are stored only in this browser (export them from Following).</p>
        <div className="row">
          {id && <button type="button" className="btn ghost" style={{ color: "var(--red)" }} onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
