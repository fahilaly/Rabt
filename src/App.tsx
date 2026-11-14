import React, { useEffect, useRef, useState } from "react";
import type { Notice } from "./types";
import { LuBell, LuRotateCcw, LuPlay, LuMessageSquare, LuMenu, LuX, LuMoon, LuSun, LuChartLine, LuShieldCheck, LuTrophy } from "react-icons/lu";
import { fmtTime, isLate, useStore, WAITING } from "./store";
import { NoticeList } from "./ui";
import HospitalPortal from "./HospitalPortal";
import CompanyPortal from "./CompanyPortal";
import TransportPortal from "./TransportPortal";
import { ImpactPage, PrivacyPage, ScorecardPage } from "./AboutPages";
import { DemoBar, SmsPanel, SmsToast, smsFor, startDemo, type View } from "./Demo";
import { useT } from "./i18n";

type Portal = "hospital" | "company" | "transport";
type HTab = "ward" | "patients" | "register" | "report";
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
  /** an "About Rabt" page shown instead of the role's section */
  about: About | null;
}
type About = "impact" | "privacy" | "scorecard";
const PREFS_KEY = "rabt-prototype-view-4";
const ROLES: [Portal, string, string][] = [
  ["hospital", "Hospital", "1"],
  ["company", "Company", "2"],
  ["transport", "Transport", "3"],
];
const defaults: Prefs = { portal: "hospital", hospitalId: "h1", companyId: "c1", driverId: "d1", htab: "patients", ctab: "requests", ttab: "driver", about: null };

type Theme = "light" | "dark";
const THEME_KEY = "rabt-theme";

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

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
  const { state, now, advanceClock, reset } = store;
  const { t, p, tr, lang, setLang } = useT();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [follow, setFollow] = useState(true);
  const [smsOpen, setSmsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const [welcome, setWelcome] = useState(() => {
    try {
      return !localStorage.getItem("rabt-welcomed");
    } catch {
      return false;
    }
  });
  const welcomeDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = welcomeDialog.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(".welcome-demo")?.focus();
    }
  });
  const pickRole = (v: Partial<Prefs> | null) => {
    try {
      localStorage.setItem("rabt-welcomed", "1");
    } catch {
      /* ignore */
    }
    setWelcome(false);
    if (v) set(v);
    else startDemo(store);
  };

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const set = (p: Partial<Prefs>) => {
    setPrefs((x) => ({ ...x, about: null, ...p }));
    setOpenId(null);
    setBellOpen(false);
  };

  // choosing a section also closes the phone menu
  const go = (p: Partial<Prefs>) => {
    set(p);
    setMenuOpen(false);
  };
  const sectionLabel = t(
    prefs.about
      ? { impact: "Impact", privacy: "Who sees what", scorecard: "Company scorecard" }[prefs.about]
      : prefs.portal === "hospital"
      ? { ward: "Ward screen", patients: "Patients", register: "Register pilgrim", report: "Today's report" }[prefs.htab]
      : prefs.portal === "company"
        ? { requests: "Pickup requests", pilgrims: "Pilgrims in hospital", history: "Completed" }[prefs.ctab]
        : { driver: "Driver app", dispatch: "Fleet dispatch" }[prefs.ttab]
  );
  const roleLabel = t(prefs.about ? "About Rabt" : prefs.portal === "hospital" ? "Hospital" : prefs.portal === "company" ? "Company" : "Transport");

  // demo mode moves the screen to each step's view
  const nav = (v: View) => {
    setPrefs((x) => ({
      ...x,
      about: null,
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
      const narrow = typeof window !== "undefined" && window.innerWidth <= 860;
      const t = setTimeout(() => setToast(null), narrow ? 4000 : 6000);
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

  // "Meanwhile" note: when an action here notifies another role, say so and offer to go there.
  // Lets one presenter on one tab follow the flow between hospital, company and driver.
  const [elsewhere, setElsewhere] = useState<Notice | null>(null);
  const lastNoticeId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const n = [...state.notices].sort((a, b) => b.at - a.at)[0];
    const id = n?.id;
    if (lastNoticeId.current !== undefined && n && id !== lastNoticeId.current && !demoOn) {
      const here = n.audience.kind === audience.kind && n.audience.id === audience.id;
      if (!here && n.audience.kind !== "dispatch") {
        setElsewhere(n);
        const tm = setTimeout(() => setElsewhere(null), 9000);
        lastNoticeId.current = id;
        return () => clearTimeout(tm);
      }
    }
    lastNoticeId.current = id ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.notices, demoOn]);
  const whereName = (n: Notice) =>
    n.audience.kind === "hospital"
      ? p(store.hospital(n.audience.id).name)
      : n.audience.kind === "company"
        ? p(store.company(n.audience.id).name)
        : t("the driver's phone");
  const goElsewhere = (n: Notice) => {
    setElsewhere(null);
    const a = n.audience;
    if (a.kind === "hospital") setPrefs((x) => ({ ...x, about: null, portal: "hospital", hospitalId: a.id, htab: "patients" }));
    else if (a.kind === "company") setPrefs((x) => ({ ...x, about: null, portal: "company", companyId: a.id, ctab: "requests" }));
    else if (a.kind === "driver") setPrefs((x) => ({ ...x, about: null, portal: "transport", driverId: a.id, ttab: "driver" }));
    if (n.pilgrimId && a.kind !== "driver") setOpenId(n.pilgrimId);
  };

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
      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <div className="side-top">
          <div className="wordmark">
            <span className="wm">{t("Rabt")}</span>
            <span className="wm-sub">{t("Pilgrim pickup from hospital")}</span>
          </div>
          <span className="side-current">
            {roleLabel} · <b>{sectionLabel}</b>
          </span>
          <div className="side-top-actions">
            <button className="icon-btn top-toggle lang-btn" lang={lang === "ar" ? "en" : "ar"} aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"} title={lang === "ar" ? "English" : "العربية"} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button className="icon-btn top-toggle" aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")} title={theme === "dark" ? t("Light mode") : t("Dark mode")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <LuSun /> : <LuMoon />}
            </button>
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
          <button className="icon-btn menu-btn" aria-expanded={menuOpen} aria-controls="side-panel" aria-label={menuOpen ? t("Close menu") : t("Menu")} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <LuX /> : <LuMenu />}
          </button>
        </div>
        <div className="side-panel" id="side-panel">

        <div className="role-switch" role="tablist" aria-label={t("Role")}>
          {ROLES.map(([r, label, key]) => (
            <button key={r} role="tab" aria-selected={prefs.portal === r} className={prefs.portal === r ? "on" : ""} title={t("{label} (press {key})", { label: t(label), key })} onClick={() => set({ portal: r })}>
              {t(label)}
            </button>
          ))}
        </div>
        <span className="demo-chip dim">{t("Demo mode: no login, switch roles freely")}</span>

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
              <NavItem on={!prefs.about && prefs.htab === "patients"} onClick={() => go({ htab: "patients" })} count={treat}>
                {t("Patients")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.htab === "register"} onClick={() => go({ htab: "register" })}>
                {t("Register pilgrim")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.htab === "ward"} onClick={() => go({ htab: "ward" })} count={wardCount} alert={wardLate}>
                {t("Ward screen")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.htab === "report"} onClick={() => go({ htab: "report" })}>
                {t("Today's report")}
              </NavItem>
            </>
          )}
          {prefs.portal === "company" && (
            <>
              <NavItem on={!prefs.about && prefs.ctab === "requests"} onClick={() => go({ ctab: "requests" })} count={needs} alert={needs > 0}>
                {t("Pickup requests")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.ctab === "pilgrims"} onClick={() => go({ ctab: "pilgrims" })} count={compActive}>
                {t("Pilgrims in hospital")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.ctab === "history"} onClick={() => go({ ctab: "history" })}>
                {t("Completed")}
              </NavItem>
            </>
          )}
          {prefs.portal === "transport" && (
            <>
              <NavItem on={!prefs.about && prefs.ttab === "driver"} onClick={() => go({ ttab: "driver" })} count={driverJobs}>
                {t("Driver app")}
              </NavItem>
              <NavItem on={!prefs.about && prefs.ttab === "dispatch"} onClick={() => go({ ttab: "dispatch" })} count={openRides} alert={openRides > 0}>
                {t("Fleet dispatch")}
              </NavItem>
            </>
          )}
        </nav>

        <nav className="side-nav side-about" aria-label={t("About Rabt")}>
          <span className="label">{t("About Rabt")}</span>
          <NavItem on={prefs.about === "impact"} onClick={() => go({ about: "impact" })}>
            <LuChartLine aria-hidden="true" /> {t("Impact")}
          </NavItem>
          <NavItem on={prefs.about === "scorecard"} onClick={() => go({ about: "scorecard" })}>
            <LuTrophy aria-hidden="true" /> {t("Company scorecard")}
          </NavItem>
          <NavItem on={prefs.about === "privacy"} onClick={() => go({ about: "privacy" })}>
            <LuShieldCheck aria-hidden="true" /> {t("Who sees what")}
          </NavItem>
        </nav>

        <div className="side-foot">
          {!demoOn && (
            <button className="btn primary demo-start" onClick={() => { setMenuOpen(false); startDemo(store); }}>
              <LuPlay aria-hidden="true" /> {t("Start demo")}
            </button>
          )}
          <button className={`btn sm sms-btn ${smsOpen ? "on" : ""}`} onClick={() => { setSmsOpen(!smsOpen); setMenuOpen(false); }} aria-expanded={smsOpen}>
            <LuMessageSquare aria-hidden="true" /> {t("Messages")}
            {sms.length > 0 && <span className="mono dim">{sms.length}</span>}
          </button>
          <details className="demo-tools">
          <summary>{t("Demo tools")}</summary>
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
          </div>
          <button
            className="btn sm"
            title={t("Reset sample data")}
            onClick={() => {
              reset();
              setOpenId(null);
            }}
          >
            <LuRotateCcw aria-hidden="true" /> {t("Reset sample data")}
          </button>
          <p className="dim small">{t("Sample data. Syncs between tabs in this browser.")}</p>
          </details>
        </div>

        </div>
        {bellOpen && <Inbox onClose={() => setBellOpen(false)}>{<NoticeList items={mine.slice(0, 14)} onOpen={openFromNotice} />}</Inbox>}
      </aside>

      <main className={`content ${!prefs.about && prefs.portal === "hospital" && prefs.htab === "ward" ? "content-board" : ""} ${demoOn ? "with-demo" : ""}`}>
        {prefs.about === "impact" && <ImpactPage />}
        {prefs.about === "privacy" && <PrivacyPage />}
        {prefs.about === "scorecard" && <ScorecardPage />}
        {!prefs.about && prefs.portal === "hospital" && (
          <HospitalPortal hospitalId={prefs.hospitalId} tab={prefs.htab} setTab={(t) => set({ htab: t })} openId={openId} setOpenId={setOpenId} />
        )}
        {!prefs.about && prefs.portal === "company" && <CompanyPortal companyId={prefs.companyId} tab={prefs.ctab} openId={openId} setOpenId={setOpenId} />}
        {!prefs.about && prefs.portal === "transport" && <TransportPortal tab={prefs.ttab} driverId={prefs.driverId} />}
      </main>
      {smsOpen && <SmsPanel messages={sms} title={smsTitle} onClose={() => setSmsOpen(false)} />}
      {!smsOpen && toastMsg && <SmsToast m={toastMsg} onOpen={() => { setToast(null); setSmsOpen(true); }} />}
      {elsewhere && (
        <div className="elsewhere" role="status" aria-live="polite">
          <span className="label">{t("Meanwhile on {where}'s screen", { where: whereName(elsewhere) })}</span>
          <span>{tr(elsewhere.text)}</span>
          <div className="elsewhere-actions">
            <button className="btn sm" onClick={() => setElsewhere(null)}>
              {t("Stay here")}
            </button>
            <button className="btn sm primary" onClick={() => goElsewhere(elsewhere)}>
              {t("Go to that screen")}
            </button>
          </div>
        </div>
      )}
      <DemoBar nav={nav} follow={follow} setFollow={setFollow} />
      {welcome && !demoOn && (
        <dialog className="welcome" ref={welcomeDialog} aria-labelledby="welcome-title" aria-describedby="welcome-description" onCancel={(event) => {
          event.preventDefault();
          pickRole({ portal: "hospital", htab: "patients" });
        }}>
          <div className="welcome-box">
            <div className="welcome-heading">
              <div className="wm welcome-wm">{t("Rabt")}</div>
              <button className="btn sm" lang={lang === "ar" ? "en" : "ar"} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
                {lang === "ar" ? "English" : "العربية"}
              </button>
            </div>
            <h1 id="welcome-title">{t("From hospital to accommodation")}</h1>
            <p id="welcome-description">{t("Follow Ahmad as the hospital, travel company, and driver coordinate his ride and confirm the handoff.")}</p>
            <button className="btn primary welcome-demo" onClick={() => pickRole(null)}>
              <LuPlay aria-hidden="true" /> {t("Start guided demo")}
            </button>
            <p className="dim small">{t("The demo uses sample records and simulated messages.")}</p>
            <h2 id="welcome-roles-title">{t("Explore by role")}</h2>
            <div className="welcome-roles" role="group" aria-labelledby="welcome-roles-title">
              <button className="welcome-role" onClick={() => pickRole({ portal: "hospital", htab: "patients" })}>
                <b>{t("Hospital staff")}</b>
                <span>{t("Register pilgrims, record diagnosis, mark ready for transport.")}</span>
              </button>
              <button className="welcome-role" onClick={() => pickRole({ portal: "company", ctab: "requests" })}>
                <b>{t("Hajj or Umrah company")}</b>
                <span>{t("See your pilgrims in hospital and send a vehicle.")}</span>
              </button>
              <button className="welcome-role" onClick={() => pickRole({ portal: "transport", ttab: "driver" })}>
                <b>{t("Driver")}</b>
                <span>{t("Accept pickups and confirm each step.")}</span>
              </button>
            </div>
          </div>
        </dialog>
      )}
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
