import React, { useEffect, useRef } from "react";
import { LuX, LuCircleCheck, LuTriangleAlert, LuInfo } from "react-icons/lu";
import type { Notice, Pilgrim, Status } from "./types";
import { STATUS_LABEL, fmtTime, isLate, minutes, useStore } from "./store";

// Status shown as a small square + sentence-case text (no pills).
export function StatusText({ p, now }: { p: Pilgrim; now: number }) {
  const late = isLate(p, now);
  const tone = late ? "red" : toneFor(p.status);
  return (
    <span className={`status s-${tone}`}>
      <i aria-hidden="true" />
      {late ? `Late ${minutes(now - p.pickup!.eta!)} min` : STATUS_LABEL[p.status]}
    </span>
  );
}

export function toneFor(s: Status): "grey" | "amber" | "blue" | "done" {
  switch (s) {
    case "in_treatment":
      return "grey";
    case "ready":
    case "ride_requested":
      return "amber";
    case "assigned":
    case "accepted":
      return "blue";
    case "picked_up":
    case "arrived":
      return "done";
  }
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="ph">
      <div className="ph-text">
        <h1>{title}</h1>
        {meta && <div className="ph-meta">{meta}</div>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  );
}

// the five steps every pilgrim moves through after treatment
const STEPS: { label: string; at: (p: Pilgrim) => number | undefined }[] = [
  { label: "Ready", at: (p) => p.pickup?.requestedAt },
  { label: "Vehicle assigned", at: (p) => p.pickup?.assignedAt },
  { label: "Driver accepted", at: (p) => p.pickup?.acceptedAt },
  { label: "Picked up", at: (p) => p.pickup?.pickedUpAt },
  { label: "Arrived", at: (p) => p.pickup?.arrivedAt },
];

export function Steps({ p }: { p: Pilgrim }) {
  return (
    <ol className="steps-row" aria-label="Pickup steps">
      {STEPS.map((s) => {
        const t = s.at(p);
        return (
          <li key={s.label} className={t ? "done" : ""}>
            <span className="steps-label">{s.label}</span>
            <span className="mono steps-time">{t ? fmtTime(t) : "–"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ p }: { p: Pilgrim }) {
  const events = [...p.events].sort((a, b) => b.at - a.at);
  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={i}>
          <time className="mono">{fmtTime(e.at)}</time>
          <div>
            <div>{e.label}</div>
            <div className="dim">{e.by}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function useEscape(open: boolean, onClose: () => void, ref: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose, ref]);
}

export function Drawer({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="drawer-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="dim">{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <LuX />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="scrim center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <LuX />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr className="empty-row">
      <td colSpan={cols}>{text}</td>
    </tr>
  );
}

export function NoticeList({ items, onOpen }: { items: Notice[]; onOpen?: (pilgrimId: string) => void }) {
  const { now } = useStore();
  if (!items.length) return <div className="dim pad">No notifications.</div>;
  return (
    <ul className="notices">
      {items.map((n) => (
        <li key={n.id}>
          <button className={`notice n-${n.tone}`} onClick={() => n.pilgrimId && onOpen?.(n.pilgrimId)}>
            <span className="notice-icon" aria-hidden="true">
              {n.tone === "warn" ? <LuTriangleAlert /> : n.tone === "good" ? <LuCircleCheck /> : <LuInfo />}
            </span>
            <span className="notice-text">{n.text}</span>
            <span className="mono dim notice-time">{minutes(now - n.at) < 1 ? "now" : `${minutes(now - n.at)}m`}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// What a Hajj or Umrah company is allowed to see about its pilgrim.
export function PrivacyNote() {
  return (
    <div className="privacy">
      <div className="label">Shared with the company</div>
      <p>Name, ID, hospital, stage, expected pickup time, mobility.</p>
      <div className="label">Never shared</div>
      <p>Diagnosis, clinical notes, results.</p>
    </div>
  );
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <span className="dim small">{hint}</span>}
    </div>
  );
}

export function Section({ title, count, children, aside }: { title: string; count?: number; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="block">
      <div className="block-head">
        <h2>
          {title}
          {count !== undefined && <span className="mono dim"> {count}</span>}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
