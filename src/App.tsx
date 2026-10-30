import React, { useEffect, useRef, useState } from "react";
import { LuBell, LuRotateCcw, LuPlay, LuMessageSquare } from "react-icons/lu";
import { fmtTime, isLate, useStore, WAITING } from "./store";
import { NoticeList } from "./ui";
import HospitalPortal from "./HospitalPortal";
import CompanyPortal from "./CompanyPortal";
import TransportPortal from "./TransportPortal";
import { DemoBar, SmsPanel, SmsToast, smsFor, startDemo, type View } from "./Demo";
import { useT } from "./i18n";

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
  const store = useStore();
  const { state, now, advanceClock, reset, syncMode } = store;
  const { t, p, lang, setLang } = useT();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [follow, setFollow] = useState(true);
  const [smsOpen, setSmsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  // demo mode moves the screen to each step's view
  const nav = (v: View) => {
    setPrefs((x) => ({
      ...x,
      portal: v.portal,
      ...(v.htab ? { htab: v.htab } : {}),
      ...(v.ctab ? { ctab: v.ctab } : {}),
      ...(v.ttab ? { ttab: v.ttab } : {}),
      ...(v.hospitalId ? { hospitalId: v.hospitalId } : {}),
      ...(v.companyId ? { companyId: v.companyId } : {}),
      ...(v.driverId ? { driverId: v.driverId } : {}),
    }));
    setOpenId(v.openId ?? null);
    setBellOpen(false);
  };
  const demoOn = !!state.demo?.active;

  // simulated SMS for whoever this screen belongs to
  const smsWho =
    demoOn || prefs.portal === "hospital" || (prefs.portal === "transport" && prefs.ttab === "dispatch")
      ? null
      : prefs.portal === "company"
        ? { kind: "company" as const, id: prefs.companyId }
        : { kind: "driver" as const, id: prefs.driverId };
  const sms = smsFor(state.messages ?? [], smsWho);
  const smsTitle = smsWho
    ? smsWho.kind === "company"
      ? t("{name}'s phone", { name: store.company(smsWho.id).manager })
      : t("{name}'s phone", { name: store.driver(smsWho.id)?.name ?? "Driver" })
    : t("SMS sent by Rabt");
  const latestSms = sms[0];
  const lastSmsId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = latestSms?.id;
    if (lastSmsId.current !== undefined && id && id !== lastSmsId.current && !smsOpen) {
      setToast(id);
      const t = setTimeout(() => setToast(null), 6000);
      lastSmsId.current = id;
      return () => clearTimeout(t);
    }
    lastSmsId.current = id ?? "";
  }, [latestSms?.id, smsOpen]);
  const toastMsg = toast ? sms.find((m) => m.id === toast) : undefined;

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
            {p(h.name)}
          </option>
        ))}
      </select>
    ) : prefs.portal === "company" ? (
      <select id="persona" className="select" value={prefs.companyId} onChange={(e) => set({ companyId: e.target.value })}>
        {state.companies.map((c) => (
          <option key={c.id} value={c.id}>
            {p(c.name)}
          </option>
        ))}
      </select>
    ) : (
      <select id="persona" className="select" value={prefs.driverId} onChange={(e) => set({ driverId: e.target.value })}>
        <optgroup label={t("Company drivers")}>
          {state.drivers
            .filter((d) => d.companyId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {p(d.name)}
              </option>
            ))}
        </optgroup>
        <optgroup label={t("Fleet partner drivers")}>
          {state.drivers
            .filter((d) => !d.companyId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {p(d.name)}
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
            <span className="wm">{t("Rabt")}</span>
            <span className="wm-sub">{t("Pilgrim pickup from hospital")}</span>
          </div>
          <button
            className={`icon-btn bell ${bellOpen ? "on" : ""}`}
            aria-label={unread ? t("Notifications, {n} new", { n: unread }) : t("Notifications")}
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

        <div className="role-switch" role="tablist" aria-label={t("Role")}>
          {ROLES.map(([r, label, key]) => (
            <button key={r} role="tab" aria-selected={prefs.portal === r} className={prefs.portal === r ? "on" : ""} title={t("{label} (press {key})", { label: t(label), key })} onClick={() => set({ portal: r })}>
              {t(label)}
            </button>
          ))}
        </div>

        <div className="side-who">
          <label className="label" htmlFor="persona">
            {t(prefs.portal === "hospital" ? "Hospital" : prefs.portal === "company" ? "Company" : "Driver")}
          </label>
          {personaSelect}
          {prefs.portal === "company" && <span className="side-plan">{t(store.company(prefs.companyId).plan === "full" ? "Full plan" : "Basic plan")}</span>}
        </div>

        <nav className="side-nav" aria-label={t("Sections")}>
          {prefs.portal === "hospital" && (
            <>
              <NavItem on={prefs.htab === "ward"} onClick={() => set({ htab: "ward" })} count={wardCount} alert={wardLate}>
                {t("Recovery ward")}
              </NavItem>
              <NavItem on={prefs.htab === "patients"} onClick={() => set({ htab: "patients" })} count={treat}>
                {t("Patients")}
              </NavItem>
              <NavItem on={prefs.htab === "register"} onClick={() => set({ htab: "register" })}>
                {t("Register pilgrim")}
              </NavItem>
            </>
          )}
          {prefs.portal === "company" && (
            <>
              <NavItem on={prefs.ctab === "requests"} onClick={() => set({ ctab: "requests" })} count={needs} alert={needs > 0}>
                {t("Pickup requests")}
              </NavItem>
              <NavItem on={prefs.ctab === "pilgrims"} onClick={() => set({ ctab: "pilgrims" })} count={compActive}>
                {t("Pilgrims in hospital")}
              </NavItem>
              <NavItem on={prefs.ctab === "history"} onClick={() => set({ ctab: "history" })}>
                {t("Completed")}
              </NavItem>
            </>
          )}
          {prefs.portal === "transport" && (
            <>
              <NavItem on={prefs.ttab === "driver"} onClick={() => set({ ttab: "driver" })} count={driverJobs}>
                {t("Driver app")}
              </NavItem>
              <NavItem on={prefs.ttab === "dispatch"} onClick={() => set({ ttab: "dispatch" })} count={openRides} alert={openRides > 0}>
                {t("Fleet dispatch")}
              </NavItem>
            </>
          )}
        </nav>

        <div className="side-foot">
          {!demoOn && (
            <button className="btn primary demo-start" onClick={() => startDemo(store)}>
              <LuPlay aria-hidden="true" /> {t("Start demo")}
            </button>
          )}
          <button className={`btn sm sms-btn ${smsOpen ? "on" : ""}`} onClick={() => setSmsOpen(!smsOpen)} aria-expanded={smsOpen}>
            <LuMessageSquare aria-hidden="true" /> {t("Messages")}
            {sms.length > 0 && <span className="mono dim">{sms.length}</span>}
          </button>
          <div className="clock">
            <span className="label">{t("Demo clock")}</span>
            <span className="mono clock-time">{fmtTime(now)}</span>
          </div>
          <div className="clock-actions">
            <button className="btn sm" onClick={() => advanceClock(5)}>
              {t("+{n} min", { n: 5 })}
            </button>
            <button className="btn sm" onClick={() => advanceClock(15)}>
              {t("+{n} min", { n: 15 })}
            </button>
            <button
              className="btn sm ghost"
              aria-label={t("Reset sample data")}
              title={t("Reset sample data")}
              onClick={() => {
                reset();
                setOpenId(null);
              }}
            >
              <LuRotateCcw />
            </button>
          </div>
          <p className="dim small">
            <span className={`sync-dot ${syncMode}`} aria-hidden="true" />
            {syncMode === "shared" ? t("Synced: open this link on another device to see the same data.") : t("Sample data. Syncs between tabs in this browser.")}
          </p>
          <button className="link lang-toggle" lang={lang === "ar" ? "en" : "ar"} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>

        {bellOpen && <Inbox onClose={() => setBellOpen(false)}>{<NoticeList items={mine.slice(0, 14)} onOpen={openFromNotice} />}</Inbox>}
      </aside>

      <main className={`content ${prefs.portal === "hospital" && prefs.htab === "ward" ? "content-board" : ""} ${demoOn ? "with-demo" : ""}`}>
        {prefs.portal === "hospital" && (
          <HospitalPortal hospitalId={prefs.hospitalId} tab={prefs.htab} setTab={(t) => set({ htab: t })} openId={openId} setOpenId={setOpenId} />
        )}
        {prefs.portal === "company" && <CompanyPortal companyId={prefs.companyId} tab={prefs.ctab} openId={openId} setOpenId={setOpenId} />}
        {prefs.portal === "transport" && <TransportPortal tab={prefs.ttab} driverId={prefs.driverId} />}
      </main>
      {smsOpen && <SmsPanel messages={sms} title={smsTitle} onClose={() => setSmsOpen(false)} />}
      {!smsOpen && toastMsg && <SmsToast m={toastMsg} onOpen={() => { setToast(null); setSmsOpen(true); }} />}
      <DemoBar nav={nav} follow={follow} setFollow={setFollow} />
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
  const { t } = useT();
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
    <div className="inbox" ref={ref} role="dialog" aria-label={t("Notifications")}>
      <div className="inbox-head">{t("Notifications")}</div>
      {children}
    </div>
  );
}
