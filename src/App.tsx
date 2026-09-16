import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type AppCtx } from "./ctx";
import { loadDataset, type Dataset } from "./data";
import { navigate, useRoute } from "./lib/router";
import { isoDate, parisToday } from "./lib/dates";
import { TOPICS, type Topic } from "./shared/taxonomy";
import { nowUtcIso } from "./shared/time";
import type { PersonalEvent, Prefs, ResearchItem } from "./shared/types";
import {
  loadHomepages, loadPersonal, loadPrefs, loadResearch, nextId, saveHomepages, savePersonal, savePrefs, saveResearch,
} from "./userStore";
import CalendarPage from "./pages/CalendarPage";
import DiscoverPage from "./pages/DiscoverPage";
import FollowingPage from "./pages/FollowingPage";
import ResearchPage from "./pages/ResearchPage";
import SourcesPage from "./pages/SourcesPage";
import SearchPage from "./pages/SearchPage";
import EventDrawer from "./components/EventDrawer";
import ResearcherDrawer from "./components/ResearcherDrawer";
import SeriesDrawer from "./components/SeriesDrawer";
import { Modal } from "./components/common";

type Drawer = { kind: "event" | "researcher" | "series"; id: string };

const NAV = [
  { key: "calendar", label: "Calendar", icon: "◷", href: "day" },
  { key: "discover", label: "Discover", icon: "✦", href: "discover" },
  { key: "following", label: "Following", icon: "✓", href: "following" },
  { key: "research", label: "Research", icon: "∫", href: "research" },
  { key: "sources", label: "Sources", icon: "⋮", href: "sources" },
];

const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export default function App() {
  const route = useRoute();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [personal, setPersonal] = useState<PersonalEvent[]>(loadPersonal);
  const [research, setResearch] = useState<ResearchItem[]>(loadResearch);
  const [homepages, setHomepages] = useState<Record<string, string>>(loadHomepages);
  const [drawerStack, setDrawerStack] = useState<Drawer[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDataset().then(setDs).catch((e: Error) => setLoadError(e.message));
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const ctx = useMemo<AppCtx | null>(() => {
    if (!ds) return null;
    const push = (d: Drawer) => setDrawerStack((s) => [...s.slice(-3), d]);
    return {
      ds, prefs, topicById: TOPIC_BY_ID, toast, personal, research, homepages,
      updatePrefs: (patch) => setPrefs((p) => {
        const np = { ...p, ...patch };
        savePrefs(np);
        return np;
      }),
      savePersonalItem: (item) => setPersonal((items) => {
        const next = item.id ? items.map((x) => (x.id === item.id ? { ...x, ...item, id: x.id } : x)) : [...items, { ...item, id: nextId(items) }];
        savePersonal(next);
        return next;
      }),
      deletePersonalItem: (id) => setPersonal((items) => {
        const next = items.filter((x) => x.id !== id);
        savePersonal(next);
        return next;
      }),
      saveResearchItem: (item) => setResearch((items) => {
        const now = nowUtcIso();
        const next = item.id
          ? items.map((x) => (x.id === item.id ? { ...x, ...item, id: x.id, updated: now } : x))
          : [...items, { ...item, id: nextId(items), created: now, updated: now }];
        saveResearch(next);
        return next;
      }),
      deleteResearchItem: (id) => setResearch((items) => {
        const next = items.filter((x) => x.id !== id);
        saveResearch(next);
        return next;
      }),
      setHomepage: (rid, url) => setHomepages((m) => {
        const next = { ...m, [rid]: url };
        saveHomepages(next);
        return next;
      }),
      openEvent: (id) => push({ kind: "event", id }),
      openResearcher: (id) => push({ kind: "researcher", id }),
      openSeries: (id) => push({ kind: "series", id }),
    };
  }, [ds, prefs, toast, personal, research, homepages]);

  const section = route.parts[0] ?? "day";
  const isCalendar = ["day", "week", "month", ""].includes(section);

  useEffect(() => {
    if (section === "search") setQ(route.params.get("q") ?? "");
  }, [section, route.params]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?") setHelp((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const top = drawerStack[drawerStack.length - 1] ?? null;
  const closeTop = useCallback(() => setDrawerStack((s) => s.slice(0, -1)), []);

  const header = (
    <header className="topbar">
      <div className="brand" onClick={() => navigate(`day/${isoDate(parisToday())}`)} title="Today">
        <span className="glyph">∮</span>
        <span className="name">Paris Math Radar</span>
        <span className="sub">mathématiques à Paris</span>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n.key} href={`#/${n.href}`} className={(n.key === "calendar" ? isCalendar : section === n.key) ? "on" : ""}>{n.label}</a>
        ))}
      </nav>
      <form className="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate("search", { q: q.trim() }); }}>
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events"
          placeholder="Search: configuration spaces · Jussieu Thursday · topology next week"
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()} />
        <kbd>/</kbd>
      </form>
      <label className="row origin-select hidden-mobile" title="Starting point for travel-time estimates">
        <span className="muted">From</span>
        <select className="input" style={{ padding: "3px 6px" }} value={prefs.default_origin}
          onChange={(e) => ctx?.updatePrefs({ default_origin: e.target.value })}>
          {prefs.origins.map((o) => (
            <option key={o.id} value={o.id}>{o.label}{o.location_id || o.lat !== null ? "" : " (not set)"}</option>
          ))}
        </select>
      </label>
    </header>
  );

  if (!ctx) {
    return (
      <>
        {header}
        <div className="page">
          {loadError ? (
            <div className="banner red"><b>The event data could not be loaded.</b> {loadError}</div>
          ) : (
            <p className="muted">Loading the Paris mathematical calendar…</p>
          )}
        </div>
      </>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      {header}
      {isCalendar ? (
        <CalendarPage view={(section === "" ? "day" : section) as "day" | "week" | "month"} dateParam={route.parts[1]} />
      ) : section === "discover" ? (
        <DiscoverPage />
      ) : section === "following" ? (
        <FollowingPage />
      ) : section === "research" ? (
        <ResearchPage />
      ) : section === "sources" ? (
        <SourcesPage />
      ) : section === "search" ? (
        <SearchPage q={route.params.get("q") ?? ""} />
      ) : (
        <div className="page"><p>Not found. <a href="#/day">Back to today</a></p></div>
      )}

      <nav className="tabbar">
        {NAV.map((n) => (
          <a key={n.key} href={`#/${n.href}`} className={(n.key === "calendar" ? isCalendar : section === n.key) ? "on" : ""}>
            <span className="ic">{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>

      {top?.kind === "event" && <EventDrawer key={top.id} id={top.id} onClose={closeTop} />}
      {top?.kind === "researcher" && <ResearcherDrawer key={top.id} id={top.id} onClose={closeTop} />}
      {top?.kind === "series" && <SeriesDrawer key={top.id} id={top.id} onClose={closeTop} />}

      {help && (
        <Modal onClose={() => setHelp(false)}>
          <h3 style={{ marginBottom: 12 }}>Keyboard shortcuts</h3>
          <div className="help-grid">
            <span><kbd>t</kbd></span><span>Today</span>
            <span><kbd>←</kbd> <kbd>→</kbd> / <kbd>j</kbd> <kbd>k</kbd></span><span>Previous / next day, week or month</span>
            <span><kbd>d</kbd> <kbd>w</kbd> <kbd>m</kbd></span><span>Day / week / month view</span>
            <span><kbd>n</kbd></span><span>New personal event</span>
            <span><kbd>f</kbd></span><span>Filters</span>
            <span><kbd>/</kbd></span><span>Search</span>
            <span><kbd>Esc</kbd></span><span>Close panel</span>
            <span><kbd>?</kbd></span><span>This help</span>
          </div>
        </Modal>
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </AppContext.Provider>
  );
}
