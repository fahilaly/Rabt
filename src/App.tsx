import React, { useEffect, useRef, useState } from "react";
import { LuBell, LuRotateCcw } from "react-icons/lu";
import { fmtTime, isLate, useStore, WAITING } from "./store";
import { NoticeList } from "./ui";
import HospitalPortal from "./HospitalPortal";
import CompanyPortal from "./CompanyPortal";
import TransportPortal from "./TransportPortal";

type Portal = "hospital" | "company" | "transport";
type HTab = "ward" | "patients" | "register";
type CTab = "requests" | "pilgrims" | "history";
type TTab = "driver" | "dispatch";

interface Prefs {
  portal: Portal;
  hospitalId: string;
  companyId: string;
  driverId: string;
  htab: HTab;
  ctab: CTab;
  ttab: TTab;
}
const PREFS_KEY = "rabt-prototype-view-2";
const ROLES: [Portal, string, string][] = [
  ["hospital", "Hospital", "1"],
  ["company", "Company", "2"],
  ["transport", "Transport", "3"],
];
const defaults: Prefs = { portal: "hospital", hospitalId: "h1", companyId: "c1", driverId: "d1", htab: "ward", ctab: "requests", ttab: "driver" };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export default function App() {
  const { state, now, advanceClock, reset } = useStore();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const set = (p: Partial<Prefs>) => {
    setPrefs((x) => ({ ...x, ...p }));
    setOpenId(null);
    setBellOpen(false);
  };

  // Keys 1, 2, 3 switch role (handy when presenting). Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, select, textarea, [role=dialog]")) return;
      const r = ROLES.find(([, , k]) => k === e.key);
      if (r) set({ portal: r[0] });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const audience =
    prefs.portal === "hospital"
      ? { kind: "hospital", id: prefs.hospitalId }
      : prefs.portal === "company"
        ? { kind: "company", id: prefs.companyId }
        : prefs.ttab === "driver"
          ? { kind: "driver", id: prefs.driverId }
          : { kind: "dispatch", id: "fleet" };
  const audKey = audience.kind + ":" + audience.id;
  const mine = state.notices.filter((n) => n.audience.kind === audience.kind && n.audience.id === audience.id).sort((a, b) => b.at - a.at);
  const unread = mine.filter((n) => n.at > (seen[audKey] ?? 0)).length;

  const openFromNotice = (pid: string) => {
    setBellOpen(false);
    const p = state.pilgrims.find((x) => x.id === pid);
    if (!p) return;
    if (prefs.portal === "hospital" && p.hospitalId === prefs.hospitalId) {
      setPrefs((x) => ({ ...x, htab: x.htab === "register" ? "patients" : x.htab }));
      setOpenId(pid);
    } else if (prefs.portal === "company" && p.companyId === prefs.companyId) setOpenId(pid);
  };

  // nav counts
  const hosp = state.pilgrims.filter((p) => p.hospitalId === prefs.hospitalId);
  const wardCount = hosp.filter((p) => WAITING.includes(p.status)).length;
  const wardLate = hosp.some((p) => isLate(p, now));
  const treat = hosp.filter((p) => p.status === "in_treatment").length;
  const needs = state.pilgrims.filter((p) => p.companyId === prefs.companyId && p.status === "ready").length;
  const compActive = state.pilgrims.filter((p) => p.companyId === prefs.companyId && p.status !== "arrived").length;
  const openRides = state.pilgrims.filter((p) => p.status === "ride_requested").length;
  const driverJobs = state.pilgrims.filter((p) => p.pickup?.driverId === prefs.driverId && ["assigned", "accepted", "picked_up"].includes(p.status)).length;

  const personaSelect =
    prefs.portal === "hospital" ? (
      <select id="persona" className="select" value={prefs.hospitalId} onChange={(e) => set({ hospitalId: e.target.value })}>
        {state.hospitals.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    ) : prefs.portal === "company" ? (
      <select id="persona" className="select" value={prefs.companyId} onChange={(e) => set({ companyId: e.target.value })}>
        {state.companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    ) : (
      <select id="persona" className="select" value={prefs.driverId} onChange={(e) => set({ driverId: e.target.value })}>
        <optgroup label="Company drivers">
          {state.drivers
            .filter((d) => d.companyId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Fleet partner drivers">
          {state.drivers
            .filter((d) => !d.companyId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </optgroup>
      </select>
    );

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-top">
          <div className="wordmark">
            <span className="wm-ar" lang="ar">
              ربط
            </span>
            <span className="wm-en">Rabt</span>
          </div>
          <button
            className={`icon-btn bell ${bellOpen ? "on" : ""}`}
            aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
            aria-expanded={bellOpen}
            onClick={() => {
              setBellOpen(!bellOpen);
              if (!bellOpen) setSeen((s) => ({ ...s, [audKey]: Math.max(now, ...mine.map((n) => n.at)) }));
            }}
          >
            <LuBell />
            {unread > 0 && <span className="dot mono">{unread}</span>}
          </button>
        </div>

        <div className="role-switch" role="tablist" aria-label="Role">
          {ROLES.map(([r, label, key]) => (
            <button key={r} role="tab" aria-selected={prefs.portal === r} className={prefs.portal === r ? "on" : ""} title={`${label} (press ${key})`} onClick={() => set({ portal: r })}>
              {label}
            </button>
          ))}
        </div>

        <div className="side-who">
          <label className="label" htmlFor="persona">
            {prefs.portal === "hospital" ? "Hospital" : prefs.portal === "company" ? "Company" : "Driver"}
          </label>
          {personaSelect}
        </div>

        <nav className="side-nav" aria-label="Sections">
          {prefs.portal === "hospital" && (
            <>
              <NavItem on={prefs.htab === "ward"} onClick={() => set({ htab: "ward" })} count={wardCount} alert={wardLate}>
                Recovery ward
              </NavItem>
              <NavItem on={prefs.htab === "patients"} onClick={() => set({ htab: "patients" })} count={treat}>
                Patients
              </NavItem>
              <NavItem on={prefs.htab === "register"} onClick={() => set({ htab: "register" })}>
                Register pilgrim
              </NavItem>
            </>
          )}
          {prefs.portal === "company" && (
            <>
              <NavItem on={prefs.ctab === "requests"} onClick={() => set({ ctab: "requests" })} count={needs} alert={needs > 0}>
                Pickup requests
              </NavItem>
              <NavItem on={prefs.ctab === "pilgrims"} onClick={() => set({ ctab: "pilgrims" })} count={compActive}>
                Pilgrims in hospital
              </NavItem>
              <NavItem on={prefs.ctab === "history"} onClick={() => set({ ctab: "history" })}>
                Completed
              </NavItem>
            </>
          )}
          {prefs.portal === "transport" && (
            <>
              <NavItem on={prefs.ttab === "driver"} onClick={() => set({ ttab: "driver" })} count={driverJobs}>
                Driver app
              </NavItem>
              <NavItem on={prefs.ttab === "dispatch"} onClick={() => set({ ttab: "dispatch" })} count={openRides} alert={openRides > 0}>
                Fleet dispatch
              </NavItem>
            </>
          )}
        </nav>

        <div className="side-foot">
          <div className="clock">
            <span className="label">Demo clock</span>
            <span className="mono clock-time">{fmtTime(now)}</span>
          </div>
          <div className="clock-actions">
            <button className="btn sm" onClick={() => advanceClock(5)}>
              +5 min
            </button>
            <button className="btn sm" onClick={() => advanceClock(15)}>
              +15 min
            </button>
            <button
              className="btn sm ghost"
              aria-label="Reset sample data"
              title="Reset sample data"
              onClick={() => {
                reset();
                setOpenId(null);
              }}
            >
              <LuRotateCcw />
            </button>
          </div>
          <p className="dim small">Prototype with sample data. Open a second tab to see changes sync.</p>
        </div>

        {bellOpen && <Inbox onClose={() => setBellOpen(false)}>{<NoticeList items={mine.slice(0, 14)} onOpen={openFromNotice} />}</Inbox>}
      </aside>

      <main className={`content ${prefs.portal === "hospital" && prefs.htab === "ward" ? "content-board" : ""}`}>
        {prefs.portal === "hospital" && (
          <HospitalPortal hospitalId={prefs.hospitalId} tab={prefs.htab} setTab={(t) => set({ htab: t })} openId={openId} setOpenId={setOpenId} />
        )}
        {prefs.portal === "company" && <CompanyPortal companyId={prefs.companyId} tab={prefs.ctab} openId={openId} setOpenId={setOpenId} />}
        {prefs.portal === "transport" && <TransportPortal tab={prefs.ttab} driverId={prefs.driverId} />}
      </main>
    </div>
  );
}

function NavItem({ on, onClick, children, count, alert }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number; alert?: boolean }) {
  return (
    <button className={`nav-item ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} onClick={onClick}>
      <span>{children}</span>
      {!!count && <span className={`mono nav-count ${alert ? "alert" : ""}`}>{count}</span>}
    </button>
  );
}

function Inbox({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest(".bell")) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div className="inbox" ref={ref} role="dialog" aria-label="Notifications">
      <div className="inbox-head">Notifications</div>
      {children}
    </div>
  );
}
