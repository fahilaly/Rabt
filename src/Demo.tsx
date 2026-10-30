import React, { useEffect, useRef, useState } from "react";
import { LuPause, LuPlay, LuRotateCcw, LuSkipForward, LuX, LuMessageSquare } from "react-icons/lu";
import type { DemoState, DirectoryEntry, Sms } from "./types";
import { fmtTime, useStore } from "./store";
import { suggestChoice } from "./eta";
import { useT, type T } from "./i18n";

// ---------------------------------------------------------------------------
// Demo mode: plays one pilgrim's journey on the real app, step by step.
// The device that presses Start / Next / Play runs the actions; every device that
// has the link open sees the same data, and (with "Follow" on) the same screen.
// ---------------------------------------------------------------------------

export interface View {
  portal: "hospital" | "company" | "transport";
  htab?: "ward" | "patients" | "register";
  ctab?: "requests" | "pilgrims" | "history";
  ttab?: "driver" | "dispatch";
  hospitalId?: string;
  companyId?: string;
  driverId?: string;
  openId?: string | null;
}

type Api = ReturnType<typeof useStore>;

interface Step {
  title: string;
  where: string;
  caption: (api: Api, d: DemoState, t: T["t"]) => string;
  view: (d: DemoState) => View;
  run?: (api: Api, d: DemoState) => Partial<DemoState> | void;
}

const HOSPITAL = "h1";
const COMPANY = "c1";
const PILGRIM: DirectoryEntry = {
  idType: "booking",
  idNumber: "UMR-63118",
  name: "Ahmad Fauzi",
  nationality: "Indonesia",
  age: 59,
  companyId: COMPANY,
  accommodation: "Ibrahim Al-Khalil St, Tower A, room 1702",
};
const BUSY = ["assigned", "accepted", "picked_up"];

const p = (api: Api, d: DemoState) => api.state.pilgrims.find((x) => x.id === d.pilgrimId);
const drv = (api: Api, d: DemoState) => api.driver(d.driverId);

export const STEPS: Step[] = [
  {
    title: "A pilgrim arrives at emergency",
    where: "Hospital",
    caption: (_a, _d, t) =>
      t("Ahmad Fauzi, 59, an Umrah pilgrim from Indonesia, collapses in the heat and is brought to Al-Haram East Hospital. The desk enters his booking number and Rabt finds his company, Al-Safwa Umrah."),
    view: (d) => ({ portal: "hospital", hospitalId: HOSPITAL, htab: "patients", openId: d.pilgrimId }),
    run: (api) => {
      api.reset();
      const id = api.register(HOSPITAL, PILGRIM);
      return { pilgrimId: id, driverId: undefined };
    },
  },
  {
    title: "The company knows at once",
    where: "Company",
    caption: (api, _d, t) => {
      const c = api.company(COMPANY);
      return t("{manager}, the {company} manager, gets an SMS and sees Ahmad under Pilgrims in hospital: where he is, not why. No phone calls between hospital and company.", { manager: c.manager, company: c.name });
    },
    view: (d) => ({ portal: "company", companyId: COMPANY, ctab: "pilgrims", openId: d.pilgrimId }),
  },
  {
    title: "Diagnosis and time estimate",
    where: "Hospital",
    caption: (_a, _d, t) =>
      t("The doctor records heat exhaustion. Rabt suggests a typical stay of 2 hours for this condition and the doctor confirms. The diagnosis stays inside the hospital."),
    view: (d) => ({ portal: "hospital", hospitalId: HOSPITAL, htab: "patients", openId: d.pilgrimId }),
    run: (api, d) => {
      api.diagnose(d.pilgrimId!, { conditionId: "heat", note: "IV fluids, observe", stayMin: 120 });
    },
  },
  {
    title: "The company plans ahead",
    where: "Company",
    caption: (api, d, t) => {
      const x = p(api, d);
      const time = x?.expectedReadyAt ? fmtTime(x.expectedReadyAt) : "–";
      return t("Al-Safwa receives only the expected ready time, around {time}, by SMS and on screen. It can line up a vehicle instead of waiting for a call.", { time });
    },
    view: () => ({ portal: "company", companyId: COMPANY, ctab: "requests", openId: null }),
  },
  {
    title: "Ready for transport",
    where: "Recovery ward",
    caption: (_a, _d, t) =>
      t("Two hours later the nurse ticks the three-item checklist and taps Ready for transport. Ahmad appears on the recovery-ward board and the company gets a pickup request by SMS."),
    view: () => ({ portal: "hospital", hospitalId: HOSPITAL, htab: "ward", openId: null }),
    run: (api, d) => {
      api.rewind(d.pilgrimId!, 110);
      api.markReady(d.pilgrimId!, { medicines: true, instructions: true, cleared: true, mobility: "walking" });
    },
  },
  {
    title: "The nearest vehicle is sent",
    where: "Company",
    caption: (api, d, t) => {
      const dr = drv(api, d);
      const x = p(api, d);
      return dr
        ? t("Rabt lists Al-Safwa's drivers by travel time. {driver} is {n} min away. One tap assigns him and texts him the pickup.", { driver: dr.name, n: x?.pickup?.estimateMin ?? "–" })
        : t("Rabt lists the company's drivers by travel time and the nearest one is assigned.");
    },
    view: () => ({ portal: "company", companyId: COMPANY, ctab: "requests", openId: null }),
    run: (api, d) => {
      const free = api.state.drivers
        .filter((x) => x.companyId === COMPANY)
        .filter((x) => !api.state.pilgrims.some((y) => y.pickup?.driverId === x.id && BUSY.includes(y.status)))
        .sort((a, b) => api.etaFor(a.id, HOSPITAL).minutes - api.etaFor(b.id, HOSPITAL).minutes);
      const pick = free[0] ?? api.state.drivers.find((x) => x.companyId === COMPANY)!;
      api.assignOwn(d.pilgrimId!, pick.id);
      return { driverId: pick.id };
    },
  },
  {
    title: "The driver accepts",
    where: "Driver app",
    caption: (api, d, t) => {
      const x = p(api, d);
      const dr = drv(api, d);
      return t("{driver} accepts on his phone and confirms he will be at the hospital by {time}. The ward board now shows that time.", { driver: dr?.name ?? t("The driver"), time: x?.pickup?.eta ? fmtTime(x.pickup.eta) : "–" });
    },
    view: (d) => ({ portal: "transport", ttab: "driver", driverId: d.driverId, openId: null }),
    run: (api, d) => {
      const x = p(api, d);
      const est = x?.pickup?.estimateMin ?? 10;
      api.accept(d.pilgrimId!, suggestChoice(est, [10, 15, 20, 30]));
    },
  },
  {
    title: "Running late, alert sent",
    where: "Recovery ward",
    caption: (_a, _d, t) =>
      t("Traffic near the Haram. The promised time passes, the row turns red, and Rabt texts the company manager automatically. Nobody has to chase anyone by phone."),
    view: () => ({ portal: "hospital", hospitalId: HOSPITAL, htab: "ward", openId: null }),
    run: (api, d) => {
      const x = p(api, d);
      const eta = x?.pickup?.eta ?? api.now;
      const behind = Math.max(1, Math.ceil((eta - api.now) / 60000) + 4);
      api.rewind(d.pilgrimId!, behind);
    },
  },
  {
    title: "Picked up",
    where: "Recovery ward",
    caption: (api, d, t) =>
      t("{driver} arrives and taps Picked up. Ahmad leaves the recovery ward and the board updates for the nurses.", { driver: drv(api, d)?.name ?? t("The driver") }),
    view: () => ({ portal: "hospital", hospitalId: HOSPITAL, htab: "ward", openId: null }),
    run: (api, d) => {
      api.pickedUp(d.pilgrimId!);
    },
  },
  {
    title: "Home, case closed",
    where: "Company",
    caption: (_a, _d, t) =>
      t("Ahmad is back at his hotel. Every step was timestamped, including how long he waited in the ward. Those times feed the reports and the time estimates."),
    view: (d) => ({ portal: "company", companyId: COMPANY, ctab: "history", openId: d.pilgrimId }),
    run: (api, d) => {
      api.rewind(d.pilgrimId!, 12);
      api.arrived(d.pilgrimId!);
    },
  },
];

const AUTO_MS = 9000;

export function DemoBar({ nav, follow, setFollow }: { nav: (v: View) => void; follow: boolean; setFollow: (b: boolean) => void }) {
  const api = useStore();
  const { t } = useT();
  const apiRef = useRef(api);
  apiRef.current = api;
  const d = api.state.demo;
  const [playing, setPlaying] = useState(false);

  // follow the shared step on every device
  const stepKey = d?.active ? `${d.step}:${d.pilgrimId ?? ""}:${d.driverId ?? ""}` : "";
  useEffect(() => {
    if (!d?.active || !follow) return;
    nav(STEPS[d.step].view(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, follow]);

  const go = (i: number) => {
    const cur = apiRef.current.state.demo ?? { active: true, step: 0 };
    const patch = STEPS[i].run?.(apiRef.current, cur) ?? {};
    apiRef.current.setDemo({ ...cur, ...patch, active: true, step: i });
  };

  // autoplay runs only on the device that pressed Play
  useEffect(() => {
    if (!playing || !d?.active) return;
    if (d.step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(d.step + 1), AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, d?.step, d?.active]);

  if (!d?.active) return null;
  const step = STEPS[d.step];
  const last = d.step >= STEPS.length - 1;

  return (
    <div className="demo-bar" role="region" aria-label={t("Demo")}>
      <div className="demo-progress" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={i <= d.step ? "on" : ""} />
        ))}
      </div>
      <div className="demo-main">
        <div className="demo-text">
          <div className="demo-title">
            <span className="mono demo-count">
              {d.step + 1}/{STEPS.length}
            </span>
            <span className="demo-where">{t(step.where)}</span>
            <b>{t(step.title)}</b>
          </div>
          <p className="demo-caption">{step.caption(api, d, t)}</p>
        </div>
        <div className="demo-actions">
          <label className="demo-follow">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            <span>{t("Follow")}</span>
          </label>
          {!last && (
            <button className="btn sm" onClick={() => setPlaying(!playing)}>
              {playing ? <LuPause aria-hidden="true" /> : <LuPlay aria-hidden="true" />}
              {playing ? t("Pause") : t("Play")}
            </button>
          )}
          {!last ? (
            <button className="btn primary sm" onClick={() => go(d.step + 1)}>
              {t("Next")} <LuSkipForward aria-hidden="true" className="flip" />
            </button>
          ) : (
            <button className="btn primary sm" onClick={() => go(0)}>
              <LuRotateCcw aria-hidden="true" /> {t("Replay")}
            </button>
          )}
          <button className="icon-btn" aria-label={t("Exit demo")} title={t("Exit demo")} onClick={() => { setPlaying(false); api.setDemo(undefined); }}>
            <LuX />
          </button>
        </div>
      </div>
    </div>
  );
}

export function startDemo(api: Api) {
  const patch = STEPS[0].run!(api, { active: true, step: 0 }) ?? {};
  api.setDemo({ active: true, step: 0, ...patch });
}

// ---------------------------------------------------------------------------
// Simulated phone: shows the SMS Rabt would send. Nothing is actually sent.

export function smsFor(messages: Sms[], who: { kind: "company" | "driver"; id: string } | null) {
  return who ? messages.filter((m) => m.to.kind === who.kind && m.to.id === who.id) : messages;
}

export function SmsPanel({ messages, title, onClose }: { messages: Sms[]; title: string; onClose: () => void }) {
  const { t, tr } = useT();
  return (
    <aside className="sms-panel" aria-label={t("Simulated SMS")}>
      <div className="sms-head">
        <span>
          <LuMessageSquare aria-hidden="true" /> {title}
        </span>
        <button className="icon-btn" aria-label={t("Close messages")} onClick={onClose}>
          <LuX />
        </button>
      </div>
      <div className="sms-list">
        {messages.slice(0, 20).map((m) => (
          <div key={m.id} className="sms">
            <div className="sms-meta">
              <span>{t("To {name}", { name: m.name })}</span>
              <span className="mono">{fmtTime(m.at)}</span>
            </div>
            <div className="sms-bubble">{tr(m.text)}</div>
          </div>
        ))}
        {!messages.length && <p className="dim small sms-empty">{t("No messages yet.")}</p>}
      </div>
      <p className="sms-foot dim small">{t("Simulated. In a live version these go out by SMS or WhatsApp.")}</p>
    </aside>
  );
}

export function SmsToast({ m, onOpen }: { m: Sms; onOpen: () => void }) {
  const { t, tr } = useT();
  return (
    <button className="sms-toast" onClick={onOpen}>
      <span className="sms-toast-to">
        <LuMessageSquare aria-hidden="true" /> {t("SMS to {name}", { name: m.name })}
      </span>
      <span className="sms-toast-text">{tr(m.text)}</span>
    </button>
  );
}
