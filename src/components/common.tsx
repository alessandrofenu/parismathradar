import { useEffect, type ReactNode } from "react";
import { useApp } from "../ctx";
import type { MathEvent } from "../data";
import type { Topic } from "../shared/taxonomy";
import type { EventTopic, Tier } from "../shared/types";

export function Stars({ tier, score }: { tier: Tier; score?: number }) {
  const n = tier === "high" ? 3 : tier === "medium" ? 2 : tier === "low" ? 1 : 0;
  if (n === 0) return null;
  const label = tier === "high" ? "Highly relevant" : tier === "medium" ? "Relevant" : "Possibly interesting";
  return (
    <span className="stars" title={`${label}${score !== undefined ? ` · score ${score}/100` : ""}`} aria-label={label}>
      {"★".repeat(n)}
      <span className="off">{"★".repeat(3 - n)}</span>
    </span>
  );
}

export function tierLabel(tier: Tier): string {
  return tier === "high" ? "Highly relevant to your research" : tier === "medium" ? "Relevant to your interests"
    : tier === "low" ? "Possibly interesting" : "Outside your stated interests";
}

/** Colour of the card's left rule: the most strongly evidenced broad area. */
export function primaryColor(ev: MathEvent, topicById: Record<string, Topic>): string {
  const strong = (t: EventTopic) => (t.evidence.some((e) => e.field === "title" || e.field === "series") ? 1 : 0);
  const areas = ev.topics.filter((t) => topicById[t.id]?.grp === "area" && t.id !== "general").sort((a, b) => strong(b) - strong(a));
  const pick = areas[0] ?? ev.topics[0];
  return pick ? topicById[pick.id]?.color ?? "var(--ink-3)" : "var(--ink-3)";
}

export function TopicChips({ topics, max = 4, onlyAreas = false }: { topics: EventTopic[]; max?: number; onlyAreas?: boolean }) {
  const { topicById } = useApp();
  const list = topics
    .filter((t) => topicById[t.id] && (!onlyAreas || topicById[t.id].grp === "area"))
    .filter((t) => onlyAreas || !t.evidence.every((e) => e.field === "parent"))
    .slice(0, max);
  return (
    <span className="row wrap" style={{ gap: 4 }}>
      {list.map((t) => (
        <span key={t.id} className="chip" title={t.evidence.map((e) => `${e.field}: ${e.term}`).join("\n")}>
          <span className="dot" style={{ background: topicById[t.id].color }} />
          {topicById[t.id].label}
        </span>
      ))}
    </span>
  );
}

export function Unavailable({ children = "Information unavailable" }: { children?: ReactNode }) {
  return <span className="unavailable">{children}</span>;
}

export function Drawer({ onClose, children, head }: { onClose: () => void; children: ReactNode; head?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          {head}
          <span className="spacer" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">✕ <kbd className="hidden-mobile">Esc</kbd></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </>
  );
}

export function StatusDot({ status }: { status: string }) {
  const label: Record<string, string> = {
    ok: "OK", warning: "Warning", error: "Error", stale: "Stale", blocked: "Blocked", manual: "Manual", never_run: "Not run",
  };
  return (
    <span className={`status ${status}`}>
      <span className="dot" />
      {label[status] ?? status}
    </span>
  );
}

export function reliabilityLabel(r: string): string {
  return ({ very_high: "very high", high: "high", medium_high: "medium/high", medium: "medium", low: "low" } as Record<string, string>)[r] ?? r;
}

export function travelText(min: number | null | undefined): string | null {
  return min ? `≈ ${min} min` : null;
}
