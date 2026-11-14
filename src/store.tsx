import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FamilyContact, DemoState, DirectoryEntry, Notice, Pilgrim, ReadyChecklist, Sms, State, Status } from "./types";
import { makeSeed } from "./seed";
import { estimate, type Eta } from "./eta";
import { conditionLabel } from "./stay";

// ---------------------------------------------------------------------------
// Prototype store. Everything lives in the browser and syncs between open tabs.
// Engineers: replace load/save/broadcast with Firebase or Supabase; the action
// functions below map one-to-one onto backend calls.
// ---------------------------------------------------------------------------

export const MIN = 60_000;
const KEY = "rabt-prototype-v1";
const SEEN_KEY = "rabt-last-open";
const LATE_GRACE_MIN = 0;
// Coming back after this long starts again with fresh sample data, so the times
// on screen are current instead of hours or days old. A reload mid-demo keeps the data.
const STALE_MIN = 30;

function markOpen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function load(): State | null {
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    if (Date.now() - seen > STALE_MIN * MIN) return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    return s && s.version === 3 ? s : null;
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
  etaFor: (driverId: string, hospitalId: string) => Eta;
  lookup: (idType: DirectoryEntry["idType"], idNumber: string) => DirectoryEntry | Pilgrim | null;
  register: (hospitalId: string, entry: DirectoryEntry) => string;
  diagnose: (pilgrimId: string, d: { conditionId: string; note: string; stayMin: number | null }) => void;
  /** Nurse checks the driver's name and plate, then hands the pilgrim over. */
  handover: (pilgrimId: string) => void;
  markReady: (pilgrimId: string, checklist: ReadyChecklist) => void;
  assignOwn: (pilgrimId: string, driverId: string, estMin?: number) => void;
  requestRide: (pilgrimId: string) => void;
  dispatchAssign: (pilgrimId: string, driverId: string, estMin?: number) => void;
  accept: (pilgrimId: string, etaMin: number) => void;
  pickedUp: (pilgrimId: string) => void;
  /** Hospital reports a problem with a pickup; goes to Rabt and the company. */
  complain: (pilgrimId: string, reason: string, note: string) => void;
  /** Hospital adds, edits or removes the family contact. */
  setFamily: (pilgrimId: string, family: FamilyContact | undefined) => void;
  /** Company (or Rabt) marks a complaint as fixed. */
  resolveComplaint: (pilgrimId: string, complaintId: string, reply: string) => void;
  arrived: (pilgrimId: string) => void;
  advanceClock: (min: number) => void;
  reset: () => void;
  setDemo: (d: DemoState | undefined) => void;
  /** Demo only: move one pilgrim's whole story back in time (other patients are untouched). */
  rewind: (pilgrimId: string, min: number) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => load() ?? makeSeed(Date.now()));
  const [tick, setTick] = useState(Date.now());
  const fromRemote = useRef(false);

  // tick the clock so waiting times stay current
  useEffect(() => {
    markOpen();
    const t = setInterval(() => {
      setTick(Date.now());
      markOpen();
    }, 15_000);
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
      let messages = s.messages;
      const pilgrims = s.pilgrims.map((p) => {
        if (!late.find((l) => l.id === p.id)) return p;
        const drv = s.drivers.find((d) => d.id === p.pickup?.driverId);
        messages = [
          { ...smsCompany(s, p.companyId, `Rabt ALERT: the vehicle for ${p.name} is late. ${drv ? `${drv.name} (${drv.phone}) promised ${fmtTime(p.pickup!.eta!)}.` : ""} The hospital can see the delay.`), id: uid(), at: now },
          ...messages,
        ];
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
      return { ...s, pilgrims, notices, messages: messages.slice(0, 60) };
    });
  }, [now, state.pilgrims]);

  // escalation: nobody has sent a vehicle. 10 min reminder, 20 min second contact,
  // 30 min a Rabt ride is offered (any plan, pay per ride on the basic plan)
  useEffect(() => {
    const due = state.pilgrims.filter((p) => p.status === "ready" && p.pickup && escalationLevel(p, now) > (p.pickup.escalation ?? 0));
    if (!due.length) return;
    setState((s) => {
      let notices = s.notices;
      let messages = s.messages;
      const pilgrims = s.pilgrims.map((p) => {
        if (!due.find((x) => x.id === p.id) || !p.pickup) return p;
        const lvl = escalationLevel(p, now);
        const c = s.companies.find((x) => x.id === p.companyId)!;
        const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
        let label = "";
        if (lvl === 1) {
          messages = [{ ...smsCompany(s, p.companyId, `Rabt REMINDER: ${p.name} has been ready at ${h.name} for 10 min and no vehicle is assigned yet.`), id: uid(), at: now }, ...messages];
          notices = [notice(now, { kind: "company", id: p.companyId }, `Reminder: no vehicle yet for ${p.name} (10 min)`, "warn", p.id), ...notices];
          label = "No vehicle after 10 min. Reminder sent to the company manager";
        } else if (lvl === 2) {
          messages = [{ to: { kind: "company", id: p.companyId }, name: `${c.deputy}, ${c.name}`, phone: c.deputyPhone, text: `Rabt ESCALATION: ${p.name} has been waiting at ${h.name} for 20 min and ${c.manager} has not responded. Please send a vehicle.`, id: uid(), at: now }, ...messages];
          notices = [
            notice(now, { kind: "company", id: p.companyId }, `Escalated: ${p.name} waiting 20 min. Second contact alerted`, "warn", p.id),
            notice(now, { kind: "hospital", id: p.hospitalId }, `No vehicle yet for ${p.name}. Rabt alerted the company's second contact.`, "warn", p.id),
            ...notices,
          ];
          label = "No vehicle after 20 min. Second contact alerted";
        } else {
          messages = [{ ...smsCompany(s, p.companyId, `Rabt: ${p.name} has waited 30 min at ${h.name}. A Rabt ride is ready to send. Open Rabt and tap Request Rabt ride.`), id: uid(), at: now }, ...messages];
          notices = [
            notice(now, { kind: "company", id: p.companyId }, `Rabt ride offered for ${p.name} (waiting 30 min)`, "warn", p.id),
            notice(now, { kind: "hospital", id: p.hospitalId }, `${p.name} waiting 30 min. Rabt offered the company a ride.`, "warn", p.id),
            ...notices,
          ];
          label = "No vehicle after 30 min. Rabt ride offered to the company";
        }
        return { ...p, pickup: { ...p.pickup, escalation: lvl }, events: [...p.events, { at: now, label, by: "Rabt" }] };
      });
      return { ...s, pilgrims, notices: notices.slice(0, 80), messages: messages.slice(0, 60) };
    });
  }, [now, state.pilgrims]);

  const update = useCallback(
    (
      pilgrimId: string,
      fn: (p: Pilgrim, s: State) => Partial<Pilgrim>,
      makeNotices?: (p: Pilgrim, s: State) => Notice[],
      makeSms?: (p: Pilgrim, s: State) => SmsDraft[]
    ) => {
      setState((s) => {
        const at = Date.now() + s.clockOffset * MIN;
        let extra: Notice[] = [];
        let texts: Sms[] = [];
        const pilgrims = s.pilgrims.map((p) => {
          if (p.id !== pilgrimId) return p;
          const next = { ...p, ...fn(p, s) };
          if (makeNotices) extra = makeNotices(next, s).map((n) => ({ ...n, at }));
          if (makeSms) texts = makeSms(next, s).map((m) => ({ ...m, id: uid(), at }));
          const fam = next.status !== p.status ? familySms(next, s) : null;
          if (fam) texts = [...texts, { ...fam, id: uid(), at }];
          return next;
        });
        return { ...s, pilgrims, notices: [...extra, ...s.notices].slice(0, 80), messages: [...texts, ...s.messages].slice(0, 60) };
      });
    },
    []
  );

  const value = useMemo<Ctx>(() => {
    const hospital = (id: string) => state.hospitals.find((h) => h.id === id)!;
    const company = (id: string) => state.companies.find((c) => c.id === id)!;
    const driver = (id?: string) => state.drivers.find((d) => d.id === id);
    const etaFor = (driverId: string, hospitalId: string) => estimate(driver(driverId)!, hospital(hospitalId));

    return {
      state,
      now,
      hospital,
      company,
      driver,
      etaFor,
      lookup: (idType, idNumber) => {
        const n = idNumber.trim().toUpperCase();
        const existing = state.pilgrims.find((p) => p.idNumber.toUpperCase() === n && p.status !== "arrived");
        if (existing) return existing;
        return state.directory.find((d) => d.idType === idType && d.idNumber.toUpperCase() === n) ?? null;
      },
      register: (hospitalId, entry) => {
        const id = "p" + uid();
        setState((s) => {
          const at = Date.now() + s.clockOffset * MIN;
          const h = s.hospitals.find((x) => x.id === hospitalId)!;
          return {
          ...s,
          pilgrims: [
            {
              id, name: entry.name, nationality: entry.nationality, age: entry.age,
              idType: entry.idType, idNumber: entry.idNumber, companyId: entry.companyId,
              hospitalId, accommodation: entry.accommodation, admittedAt: at,
              status: "in_treatment", clinicalNote: "Assessment in progress", family: entry.family,
              events: [{ at, label: "Registered at emergency", by: `Desk, ${short(h.name)}` }],
            },
            ...s.pilgrims,
          ],
          notices: [
            notice(at, { kind: "company", id: entry.companyId }, `${entry.name} is being treated at ${h.name}`, "info", id),
            ...s.notices,
          ],
          messages: [
            { ...smsCompany(s, entry.companyId, `Rabt: your pilgrim ${entry.name} (${entry.idNumber}) is being treated at ${h.name}. We will send the expected ready time.`), id: uid(), at },
            ...s.messages,
          ].slice(0, 60),
          };
        });
        return id;
      },
      diagnose: (pilgrimId, d) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const base = { condition: d.conditionId, clinicalNote: d.note.trim() || conditionLabel(d.conditionId), diagnosedAt: at };
            if (d.stayMin == null)
              return { ...base, observation: true, expectedReadyAt: undefined, events: [...p.events, { at, label: "Diagnosis recorded. Under observation, no ready time yet", by: "Emergency doctor" }] };
            const ready = at + d.stayMin * MIN;
            return {
              ...base,
              observation: false,
              expectedReadyAt: ready,
              events: [...p.events, { at, label: `Diagnosis recorded. Expected ready around ${fmtTime(ready)}`, by: "Emergency doctor" }],
            };
          },
          (p) => [
            p.expectedReadyAt
              ? notice(0, { kind: "company", id: p.companyId }, `${p.name} expected ready around ${fmtTime(p.expectedReadyAt)}`, "info", p.id)
              : notice(0, { kind: "company", id: p.companyId }, `${p.name} is under observation. No ready time yet`, "info", p.id),
          ],
          (p, s) => {
            const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
            return [
              p.expectedReadyAt
                ? smsCompany(s, p.companyId, `Rabt: ${p.name} is expected to be ready around ${fmtTime(p.expectedReadyAt)} at ${h.name}. Plan a vehicle; we will confirm when ready.`)
                : smsCompany(s, p.companyId, `Rabt: ${p.name} is under observation at ${h.name}. No ready time yet; we will send one when the doctor sets it.`),
            ];
          }
        ),
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
          ],
          (p, s) => {
            const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
            const chair = p.checklist?.mobility === "wheelchair" ? " Needs an accessible vehicle." : "";
            return [smsCompany(s, p.companyId, `Rabt: ${p.name} is ready for pickup at ${h.name}, recovery ward (${h.wardPhone}).${chair} Open Rabt to send a vehicle.`)];
          }
        ),
      assignOwn: (pilgrimId, driverId, estMin) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === driverId)!;
            const c = s.companies.find((x) => x.id === p.companyId)!;
            const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
            return {
              status: "assigned",
              pickup: { ...p.pickup!, mode: "own", driverId, assignedAt: at, estimateMin: estMin ?? estimate(d, h).minutes },
              events: [...p.events, { at, label: `Own vehicle assigned: ${d.name}`, by: c.name }],
            };
          },
          (p) => [notice(0, { kind: "driver", id: driverId }, `New pickup: ${p.name}`, "info", p.id)],
          (p, s) => [smsDriver(s, driverId, newPickupText(p, s))]
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
      dispatchAssign: (pilgrimId, driverId, estMin) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((x) => x.id === driverId)!;
            const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
            return {
              status: "assigned",
              pickup: { ...p.pickup!, mode: "rabt", driverId, assignedAt: at, estimateMin: estMin ?? estimate(d, h).minutes },
              events: [...p.events, { at, label: `Partner driver assigned: ${d.name}`, by: "Fleet dispatch" }],
            };
          },
          (p, s) => [
            notice(0, { kind: "driver", id: driverId }, `New pickup: ${p.name}`, "info", p.id),
            notice(0, { kind: "company", id: p.companyId }, `Rabt driver assigned for ${p.name}: ${s.drivers.find((d) => d.id === driverId)!.name}`, "info", p.id),
          ],
          (p, s) => {
            const d = s.drivers.find((x) => x.id === driverId)!;
            return [smsDriver(s, driverId, newPickupText(p, s)), smsCompany(s, p.companyId, `Rabt: fleet driver ${d.name} (${d.plate}) assigned for ${p.name}.`)];
          }
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
      handover: (pilgrimId) => {
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const d = s.drivers.find((y) => y.id === p.pickup?.driverId);
            const h = s.hospitals.find((y) => y.id === p.hospitalId)!;
            return {
              status: "picked_up",
              pickup: { ...p.pickup!, pickedUpAt: at },
              events: [...p.events, { at, label: `Handed over to ${d?.name ?? "the driver"}, driver and plate checked`, by: `Recovery ward, ${short(h.name)}` }],
            };
          },
          (p) => [notice(0, { kind: "company", id: p.companyId }, `${p.name} has left the hospital`, "good", p.id)]
        );
      },
      setFamily: (pilgrimId, family) =>
        update(pilgrimId, (p, s) => {
          const at = Date.now() + s.clockOffset * MIN;
          const h = s.hospitals.find((y) => y.id === p.hospitalId)!;
          return {
            family,
            events: [...p.events, { at, label: family ? "Family contact added for status updates" : "Family contact removed", by: `Recovery ward, ${short(h.name)}` }],
          };
        }),
      complain: (pilgrimId, reason, note) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const h = s.hospitals.find((y) => y.id === p.hospitalId)!;
            return {
              complaints: [...(p.complaints ?? []), { id: uid(), at, reason, note: note.trim() }],
              events: [...p.events, { at, label: `Problem reported: ${reason}`, by: `Recovery ward, ${short(h.name)}` }],
            };
          },
          (p) => [
            notice(0, { kind: "company", id: p.companyId }, `Problem reported about ${p.name}: ${reason}. Please fix within 30 min`, "warn", p.id),
            notice(0, { kind: "dispatch", id: "fleet" }, `Problem reported about ${p.name}: ${reason}`, "warn", p.id),
          ],
          (p, s) => [smsCompany(s, p.companyId, `Rabt: the hospital reported a problem about ${p.name}: ${reason}. Please fix it within 30 min; Rabt is following up.`)]
        ),
      resolveComplaint: (pilgrimId, complaintId, reply) =>
        update(
          pilgrimId,
          (p, s) => {
            const at = Date.now() + s.clockOffset * MIN;
            const c = s.companies.find((y) => y.id === p.companyId)!;
            return {
              complaints: (p.complaints ?? []).map((x) => (x.id === complaintId ? { ...x, resolvedAt: at, reply: reply.trim() } : x)),
              events: [...p.events, { at, label: "Problem fixed and reported back to the hospital", by: c.name }],
            };
          },
          (p) => [notice(0, { kind: "hospital", id: p.hospitalId }, `${p.name}: the company fixed the reported problem`, "good", p.id)]
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
          (p) => [notice(0, { kind: "company", id: p.companyId }, `${p.name} arrived at the accommodation. Case closed.`, "good", p.id)],
          (p, s) => [smsCompany(s, p.companyId, `Rabt: ${p.name} arrived at ${p.accommodation} at ${fmtTime(p.pickup!.arrivedAt!)}. Case closed.`)]
        ),
      advanceClock: (min) => setState((s) => ({ ...s, clockOffset: s.clockOffset + min })),
      reset: () => setState(makeSeed(Date.now())),
      setDemo: (d) => setState((s) => ({ ...s, demo: d })),
      rewind: (pilgrimId, min) =>
        setState((s) => {
          const dt = min * MIN;
          const map = new Map<string, string>();
          const sh = (t?: number) => {
            if (t == null) return t;
            map.set(fmtTime(t), fmtTime(t - dt));
            return t - dt;
          };
          const target = s.pilgrims.find((p) => p.id === pilgrimId);
          if (!target) return s;
          const pilgrims = s.pilgrims.map((p) =>
            p.id !== pilgrimId
              ? p
              : {
                  ...p,
                  admittedAt: sh(p.admittedAt)!,
                  diagnosedAt: sh(p.diagnosedAt),
                  expectedReadyAt: sh(p.expectedReadyAt),
                  events: p.events.map((e) => ({ ...e, at: sh(e.at)! })),
                  pickup: p.pickup && {
                    ...p.pickup,
                    requestedAt: sh(p.pickup.requestedAt)!,
                    assignedAt: sh(p.pickup.assignedAt),
                    acceptedAt: sh(p.pickup.acceptedAt),
                    eta: sh(p.pickup.eta),
                    pickedUpAt: sh(p.pickup.pickedUpAt),
                    arrivedAt: sh(p.pickup.arrivedAt),
                  },
                }
          );
          const fix = (txt: string) => txt.replace(/\b\d\d:\d\d\b/g, (x) => map.get(x) ?? x);
          return {
            ...s,
            pilgrims: pilgrims.map((p) => (p.id !== pilgrimId ? p : { ...p, events: p.events.map((e) => ({ ...e, label: fix(e.label) })) })),
            notices: s.notices.map((n) => (n.pilgrimId === pilgrimId ? { ...n, at: n.at - dt, text: fix(n.text) } : n)),
            messages: s.messages.map((m) => (m.text.includes(target.name) ? { ...m, at: m.at - dt, text: fix(m.text) } : m)),
          };
        }),
    };
  }, [state, now, update]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function escalationLevel(p: Pilgrim, now: number) {
  if (p.status !== "ready" || !p.pickup) return 0;
  const w = (now - p.pickup.requestedAt) / MIN;
  return w >= 30 ? 3 : w >= 20 ? 2 : w >= 10 ? 1 : 0;
}


function notice(at: number, audience: Notice["audience"], text: string, tone: Notice["tone"], pilgrimId?: string): Notice {
  return { id: uid(), at, audience, text, tone, pilgrimId };
}

type SmsDraft = Omit<Sms, "id" | "at">;

function smsCompany(s: State, companyId: string, text: string): SmsDraft {
  const c = s.companies.find((x) => x.id === companyId)!;
  return { to: { kind: "company", id: companyId }, name: `${c.manager}, ${c.name}`, phone: c.managerPhone, text };
}

// Status updates for the family: where the pilgrim is in the journey home, nothing medical.
function familySms(p: Pilgrim, s: State): SmsDraft | null {
  if (!p.family) return null;
  const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
  const text =
    p.status === "ready"
      ? `Rabt: ${p.name} is ready to leave ${h.name}. The company is arranging a car.`
      : p.status === "accepted" && p.pickup?.eta
        ? `Rabt: a car is on the way to ${h.name} for ${p.name}, expected around ${fmtTime(p.pickup.eta)}.`
        : p.status === "arrived"
          ? `Rabt: ${p.name} is back at the accommodation.`
          : null;
  return text ? { to: { kind: "family", id: p.id }, name: p.family.name, phone: p.family.phone, text } : null;
}

function smsDriver(s: State, driverId: string, text: string): SmsDraft {
  const d = s.drivers.find((x) => x.id === driverId)!;
  return { to: { kind: "driver", id: driverId }, name: d.name, phone: d.phone, text };
}

function newPickupText(p: Pilgrim, s: State) {
  const h = s.hospitals.find((x) => x.id === p.hospitalId)!;
  return `Rabt: new pickup. ${p.name} at ${h.name}, recovery ward, to ${p.accommodation}. Open the driver app to accept.`;
}

function short(name: string) {
  return name.replace(/ (Hospital|Medical Center)$/, "");
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
