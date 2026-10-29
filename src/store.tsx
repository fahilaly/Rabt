import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryEntry, Notice, Pilgrim, ReadyChecklist, State, Status } from "./types";
import { makeSeed } from "./seed";

// ---------------------------------------------------------------------------
// Prototype store. Everything lives in the browser and syncs between open tabs.
// Engineers: replace load/save/broadcast with Firebase or Supabase; the action
// functions below map one-to-one onto backend calls.
// ---------------------------------------------------------------------------

export const MIN = 60_000;
const KEY = "rabt-prototype-v1";
const LATE_GRACE_MIN = 0;

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    return s && s.version === 1 ? s : null;
  } catch {
    return null;
  }
}
function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

let channel: BroadcastChannel | null = null;
try {
  channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("rabt-prototype") : null;
} catch {
  channel = null;
}
const TAB_ID = Math.random().toString(36).slice(2);

const uid = () => Math.random().toString(36).slice(2, 10);

export const STATUS_LABEL: Record<Status, string> = {
  in_treatment: "In treatment",
  ready: "Pickup requested",
  ride_requested: "Rabt ride requested",
  assigned: "Driver assigned",
  accepted: "On the way",
  picked_up: "Picked up",
  arrived: "Arrived",
};

// statuses where the pilgrim is cleared and waiting in the recovery ward
export const WAITING: Status[] = ["ready", "ride_requested", "assigned", "accepted"];

export function isLate(p: Pilgrim, now: number) {
  return p.status === "accepted" && !!p.pickup?.eta && now > p.pickup.eta + LATE_GRACE_MIN * MIN;
}

export function minutes(ms: number) {
  return Math.max(0, Math.round(ms / MIN));
}

export function fmtTime(t: number) {
  const d = new Date(t);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

interface Ctx {
  state: State;
  now: number;
  hospital: (id: string) => State["hospitals"][number];
  company: (id: string) => State["companies"][number];
  driver: (id?: string) => State["drivers"][number] | undefined;
  lookup: (idType: DirectoryEntry["idType"], idNumber: string) => DirectoryEntry | Pilgrim | null;
  register: (hospitalId: string, entry: DirectoryEntry) => string;
  markReady: (pilgrimId: string, checklist: ReadyChecklist) => void;
  assignOwn: (pilgrimId: string, driverId: string) => void;
  requestRide: (pilgrimId: string) => void;
  dispatchAssign: (pilgrimId: string, driverId: string) => void;
  accept: (pilgrimId: string, etaMin: number) => void;
  pickedUp: (pilgrimId: string) => void;
  arrived: (pilgrimId: string) => void;
  advanceClock: (min: number) => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => load() ?? makeSeed(Date.now()));
  const [tick, setTick] = useState(Date.now());
  const fromRemote = useRef(false);

  // tick the clock so waiting times stay current
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = tick + state.clockOffset * MIN;

  // persist + broadcast every local change
  useEffect(() => {
    save(state);
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    try {
      channel?.postMessage({ from: TAB_ID, state });
    } catch {
      /* ignore */
    }
  }, [state]);

  // receive changes from other tabs
  useEffect(() => {
    if (!channel) return;
    const onMsg = (e: MessageEvent) => {
      if (!e.data || e.data.from === TAB_ID) return;
      fromRemote.current = true;
      setState(e.data.state);
    };
    channel.addEventListener("message", onMsg);
    return () => channel?.removeEventListener("message", onMsg);
  }, []);

  // late detection: raise one alert per pickup when the promised time passes
  useEffect(() => {
    const late = state.pilgrims.filter((p) => isLate(p, now) && !p.pickup?.lateAlertSent);
    if (!late.length) return;
    setState((s) => {
      let notices = s.notices;
      const pilgrims = s.pilgrims.map((p) => {
        if (!late.find((l) => l.id === p.id)) return p;
        const drv = s.drivers.find((d) => d.id === p.pickup?.driverId);
        notices = [
          notice(now, { kind: "company", id: p.companyId }, `Vehicle late for ${p.name}: arrival time passed${drv ? ` (${drv.name})` : ""}`, "warn", p.id),
          notice(now, { kind: "hospital", id: p.hospitalId }, `Vehicle late for ${p.name}. The company manager has been alerted.`, "warn", p.id),
          ...notices,
        ];
        return {
          ...p,
          pickup: { ...p.pickup!, lateAlertSent: true },
          events: [...p.events, { at: now, label: "Vehicle late: arrival time passed. Company manager alerted", by: "Rabt" }],
        };
      });
      return { ...s, pilgrims, notices };
    });
  }, [now, state.pilgrims]);

  const update = useCallback(
    (pilgrimId: string, fn: (p: Pilgrim, s: State) => Partial<Pilgrim>, makeNotices?: (p: Pilgrim, s: State) => Notice[]) => {
      setState((s) => {
        const at = Date.now() + s.clockOffset * MIN;
        let extra: Notice[] = [];
        const pilgrims = s.pilgrims.map((p) => {
          if (p.id !== pilgrimId) return p;
          const next = { ...p, ...fn(p, s) };
          if (makeNotices) extra = makeNotices(next, s).map((n) => ({ ...n, at }));
          return next;
        });
        return { ...s, pilgrims, notices: [...extra, ...s.notices].slice(0, 80) };
      });
    },
    []
  );

  const value = useMemo<Ctx>(() => {
    const nowFn = () => Date.now() + state.clockOffset * MIN;
    const hospital = (id: string) => state.hospitals.find((h) => h.id === id)!;
    const company = (id: string) => state.companies.find((c) => c.id === id)!;
    const driver = (id?: string) => state.drivers.find((d) => d.id === id);

    return {
      state,
      now,
      hospital,
      company,
      driver,
      lookup: (idType, idNumber) => {
        const n = idNumber.trim().toUpperCase();
        const existing = state.pilgrims.find((p) => p.idNumber.toUpperCase() === n && p.status !== "arrived");
        if (existing) return existing;
        return state.directory.find((d) => d.idType === idType && d.idNumber.toUpperCase() === n) ?? null;
      },
      register: (hospitalId, entry) => {
        const id = "p" + uid();
        const at = nowFn();
        const h = hospital(hospitalId);
        setState((s) => ({
          ...s,
          pilgrims: [
            {
              id, name: entry.name, nationality: entry.nationality, age: entry.age,
              idType: entry.idType, idNumber: entry.idNumber, companyId: entry.companyId,
              hospitalId, accommodation: entry.accommodation, admittedAt: at,
              status: "in_treatment", clinicalNote: "Assessment in progress",
              events: [{ at, label: "Registered at emergency", by: `Desk, ${short(h.name)}` }],
            },
            ...s.pilgrims,
          ],
          notices: [
            notice(at, { kind: "company", id: entry.companyId }, `${entry.name} is being treated at ${h.name}`, "info", id),
            ...s.notices,
          ],
        }));
        return id;
      },
      markReady: (pilgrimId, checklist) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
            return {
              status: "ready",
              checklist,
              pickup: { requestedAt: at },
              events: [...p.events, { at, label: `Ready for transport (${checklist.mobility}), pickup requested`, by: `Recovery ward, ${short(h.name)}` }],
            };
          },
          (p, s) => [
            notice(0, { kind: "company", id: p.companyId }, `Pickup requested for ${p.name} at ${s.hospitals.find((h) => h.id === p.hospitalId)!.name}`, "info", p.id),
          ]
        ),
      assignOwn: (pilgrimId, driverId) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === driverId)!;
            const c = s.companies.find((x) => x.id === p.companyId)!;
            return {
              status: "assigned",
              pickup: { ...p.pickup!, mode: "own", driverId, assignedAt: at },
              events: [...p.events, { at, label: `Own vehicle assigned: ${d.name}`, by: c.name }],
            };
          },
          (p) => [notice(0, { kind: "driver", id: driverId }, `New pickup: ${p.name}`, "info", p.id)]
        ),
      requestRide: (pilgrimId) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const c = s.companies.find((x) => x.id === p.companyId)!;
            return {
              status: "ride_requested",
              pickup: { ...p.pickup!, mode: "rabt" },
              events: [...p.events, { at, label: "Rabt ride requested", by: c.name }],
            };
          },
          (p, s) => [
            notice(0, { kind: "dispatch", id: "fleet" }, `New Rabt ride request: ${p.name} at ${s.hospitals.find((h) => h.id === p.hospitalId)!.name}`, "info", p.id),
          ]
        ),
      dispatchAssign: (pilgrimId, driverId) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === driverId)!;
            return {
              status: "assigned",
              pickup: { ...p.pickup!, mode: "rabt", driverId, assignedAt: at },
              events: [...p.events, { at, label: `Partner driver assigned: ${d.name}`, by: "Fleet dispatch" }],
            };
          },
          (p, s) => [
            notice(0, { kind: "driver", id: driverId }, `New pickup: ${p.name}`, "info", p.id),
            notice(0, { kind: "company", id: p.companyId }, `Rabt driver assigned for ${p.name}: ${s.drivers.find((d) => d.id === driverId)!.name}`, "info", p.id),
          ]
        ),
      accept: (pilgrimId, etaMin) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === p.pickup?.driverId)!;
            return {
              status: "accepted",
              pickup: { ...p.pickup!, acceptedAt: at, eta: at + etaMin * MIN, lateAlertSent: false },
              events: [...p.events, { at, label: `Driver accepted, arriving in ${etaMin} min`, by: d.name }],
            };
          },
          (p, s) => {
            const d = s.drivers.find((x) => x.id === p.pickup?.driverId)!;
            return [
              notice(0, { kind: "company", id: p.companyId }, `${d.name} accepted ${p.name}, arriving ${fmtTime(p.pickup!.eta!)}`, "good", p.id),
              notice(0, { kind: "hospital", id: p.hospitalId }, `Vehicle for ${p.name} arriving ${fmtTime(p.pickup!.eta!)} (${d.vehicle}, ${d.plate})`, "good", p.id),
            ];
          }
        ),
      pickedUp: (pilgrimId) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === p.pickup?.driverId)!;
            return {
              status: "picked_up",
              pickup: { ...p.pickup!, pickedUpAt: at },
              events: [...p.events, { at, label: "Picked up from hospital", by: d.name }],
            };
          },
          (p) => [notice(0, { kind: "company", id: p.companyId }, `${p.name} has left the hospital`, "good", p.id)]
        ),
      arrived: (pilgrimId) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === p.pickup?.driverId)!;
            return {
              status: "arrived",
              pickup: { ...p.pickup!, arrivedAt: at },
              events: [...p.events, { at, label: "Arrived at accommodation", by: d.name }],
            };
          },
          (p) => [notice(0, { kind: "company", id: p.companyId }, `${p.name} arrived at the accommodation. Case closed.`, "good", p.id)]
        ),
      advanceClock: (min) => setState((s) => ({ ...s, clockOffset: s.clockOffset + min })),
      reset: () => setState(makeSeed(Date.now())),
    };
  }, [state, now, update]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

function notice(at: number, audience: Notice["audience"], text: string, tone: Notice["tone"], pilgrimId?: string): Notice {
  return { id: uid(), at, audience, text, tone, pilgrimId };
}

function short(name: string) {
  return name.replace(/ (Hospital|Medical Center)$/, "");
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
