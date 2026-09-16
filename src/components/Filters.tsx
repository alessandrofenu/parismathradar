import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../ctx";
import { institutionsWithUpcoming } from "../data";
import { EVENT_TYPE_LABELS, TOPICS } from "../shared/taxonomy";
import type { Filters } from "../types";

export const DEFAULT_FILTERS: Filters = { minScore: 0, areas: [], institutions: [], types: [], showPersonal: true };

export function loadFilters(): Filters {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem("mr-filters") ?? "{}") };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function activeCount(f: Filters): number {
  return (f.minScore ? 1 : 0) + f.areas.length + f.institutions.length + f.types.length + (f.showPersonal ? 0 : 1);
}

const TYPES = ["seminar", "working_group", "colloquium", "conference", "workshop", "school", "course", "doctoral_seminar", "thesis_defense", "program"];

export default function FiltersButton({ filters, setFilters, openSignal }: { filters: Filters; setFilters: (f: Filters) => void; openSignal: number }) {
  const { ds, prefs, updatePrefs } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const insts = useMemo(() => institutionsWithUpcoming(ds).filter((i) => i.upcoming > 0), [ds]);
  useEffect(() => {
    if (openSignal) setOpen((o) => !o);
  }, [openSignal]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const n = activeCount(filters);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`btn ${n ? "on" : ""}`} onClick={() => setOpen(!open)} title="Filters (f)">Filters{n ? ` · ${n}` : ""}</button>
      {open && (
        <div className="popover">
          <div className="filter-group">
            <span className="caps">Relevance</span>
            <div className="seg">
              {([[0, "All"], [20, "★+"], [40, "★★+"], [65, "★★★"]] as const).map(([v, l]) => (
                <button key={v} className={filters.minScore === v ? "on" : ""} onClick={() => set({ minScore: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="caps">Subjects</span>
            <div className="row wrap" style={{ gap: 5 }}>
              {TOPICS.filter((t) => t.grp === "area").map((t) => (
                <button key={t.id} className={`chip ${filters.areas.includes(t.id) ? "on" : ""}`} onClick={() => set({ areas: toggle(filters.areas, t.id) })}>
                  <span className="dot" style={{ background: t.color }} />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="caps">Institutions</span>
            <div className="row wrap" style={{ gap: 5 }}>
              {insts.map((i) => (
                <button key={i.id} className={`chip ${filters.institutions.includes(i.id) ? "on" : ""}`} title={i.name}
                  onClick={() => set({ institutions: toggle(filters.institutions, i.id) })}>{i.short_name}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="caps">Event types</span>
            <div className="row wrap" style={{ gap: 5 }}>
              {TYPES.map((t) => (
                <button key={t} className={`chip ${filters.types.includes(t) ? "on" : ""}`} onClick={() => set({ types: toggle(filters.types, t) })}>
                  {EVENT_TYPE_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="caps">Display</span>
            <label className="row small"><input type="checkbox" checked={filters.showPersonal} onChange={(e) => set({ showPersonal: e.target.checked })} /> Show my personal events</label>
            <label className="row small"><input type="checkbox" checked={prefs.show_placeholders} onChange={(e) => updatePrefs({ show_placeholders: e.target.checked })} /> Show announced slots without speaker (TBA)</label>
            <label className="row small"><input type="checkbox" checked={prefs.show_outreach} onChange={(e) => updatePrefs({ show_outreach: e.target.checked })} /> Show outreach &amp; training (exhibitions, software courses)</label>
            <label className="row small"><input type="checkbox" checked={prefs.show_outside_region} onChange={(e) => updatePrefs({ show_outside_region: e.target.checked })} /> Show events held outside Île-de-France</label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</button>
            <span className="spacer" />
            <button className="btn small primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
