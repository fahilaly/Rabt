// Numbers for the scorecard and the "estimate vs actual" view, worked out from the
// timestamps Rabt already records. Nothing here is machine learning: it is the data
// a real version would use to tune the typical stays and travel estimates.

import type { Company, Pilgrim } from "./types";

const MIN = 60_000;
const round = (ms: number) => Math.round(ms / MIN);

/** Minutes the real event came after Rabt's estimate (negative = earlier). */
export function accuracyOf(p: Pilgrim) {
  const k = p.pickup;
  const ready = p.expectedReadyAt && k?.requestedAt ? round(k.requestedAt - p.expectedReadyAt) : null;
  const travelActual = k?.assignedAt && k.pickedUpAt ? round(k.pickedUpAt - k.assignedAt) : null;
  const travel = travelActual != null && k?.estimateMin != null ? travelActual - k.estimateMin : null;
  return { ready, travel, travelActual };
}

export interface Score {
  pickups: number;
  responseMin: number | null; // ready → vehicle assigned
  waitMin: number | null; // ready → left the ward
  lateRate: number | null; // share of accepted pickups that passed the promised time
  escalated: number; // pickups that needed at least one reminder
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Today's figures for one company, from the cases in the app. */
export function scoreToday(c: Company, pilgrims: Pilgrim[]): Score {
  const mine = pilgrims.filter((p) => p.companyId === c.id && p.pickup);
  const assigned = mine.filter((p) => p.pickup!.assignedAt);
  const left = mine.filter((p) => p.pickup!.pickedUpAt);
  const promised = mine.filter((p) => p.pickup!.eta);
  const late = promised.filter((p) => p.pickup!.lateAlertSent || (p.pickup!.pickedUpAt && p.pickup!.pickedUpAt > p.pickup!.eta!));
  return {
    pickups: left.length,
    responseMin: avg(assigned.map((p) => round(p.pickup!.assignedAt! - p.pickup!.requestedAt))),
    waitMin: avg(left.map((p) => round(p.pickup!.pickedUpAt! - p.pickup!.requestedAt))),
    lateRate: promised.length ? Math.round((late.length / promised.length) * 100) : null,
    escalated: mine.filter((p) => (p.pickup!.escalation ?? 0) > 0).length,
  };
}

// SAMPLE season figures so the scorecard has something to show. Not real data.
export const SEASON_SAMPLE: Record<string, Score> = {
  c1: { pickups: 412, responseMin: 9, waitMin: 24, lateRate: 6, escalated: 18 },
  c2: { pickups: 268, responseMin: 21, waitMin: 41, lateRate: 18, escalated: 47 },
  c3: { pickups: 335, responseMin: 12, waitMin: 28, lateRate: 9, escalated: 22 },
};

/** Average estimate error over closed cases. */
export function accuracySummary(pilgrims: Pilgrim[]) {
  const all = pilgrims.map(accuracyOf);
  const r = all.map((a) => a.ready).filter((x): x is number => x != null);
  const tr = all.map((a) => a.travel).filter((x): x is number => x != null);
  const absAvg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length) : null);
  return { readyCases: r.length, readyErr: absAvg(r), travelCases: tr.length, travelErr: absAvg(tr) };
}

// ---------------------------------------------------------------------------
// Company readiness: can the company collect everyone expected out soon?
// demand = pilgrims waiting now + pilgrims expected ready in the next hour
// supply = own vehicles not on a trip (a full-plan company can also use Rabt rides)
// shown as "can collect X of Y": one dot per pilgrim expected, filled when a car is free
// ---------------------------------------------------------------------------

export interface Readiness {
  score: number;
  level: "good" | "watch" | "risk";
  expected: number; // waiting now + expected ready within the hour
  waiting: number; // ready, no vehicle yet
  vehicles: number; // own vehicles free now
  drivers: number; // own drivers on duty
  pickedUp: number; // collected today
  late: number; // vehicles past their promised time now
  short: number; // how many more vehicles are needed
}

const BUSY_STATUSES = ["assigned", "accepted", "picked_up"];

export function readinessOf(companyId: string, s: { pilgrims: Pilgrim[]; drivers: { id: string; companyId: string | null }[] }, now: number): Readiness {
  const mine = s.pilgrims.filter((p) => p.companyId === companyId);
  const waiting = mine.filter((p) => p.status === "ready").length;
  const soon = mine.filter((p) => p.status === "in_treatment" && p.expectedReadyAt && p.expectedReadyAt - now <= 60 * MIN).length;
  const expected = waiting + soon;
  const own = s.drivers.filter((d) => d.companyId === companyId);
  const busy = new Set(s.pilgrims.filter((p) => BUSY_STATUSES.includes(p.status)).map((p) => p.pickup?.driverId));
  const vehicles = own.filter((d) => !busy.has(d.id)).length;
  const late = mine.filter((p) => ["assigned", "accepted"].includes(p.status) && p.pickup?.eta && now > p.pickup.eta).length;
  const pickedUp = mine.filter((p) => p.pickup?.pickedUpAt).length;
  const short = Math.max(0, expected - vehicles);
  const score = expected === 0 ? 100 : Math.min(100, Math.round((vehicles / expected) * 100));
  return {
    score,
    // plain rule: enough cars and none late = ready; one car short or a car late = watch
    level: short === 0 && late === 0 ? "good" : short <= 1 ? "watch" : "risk",
    expected,
    waiting,
    vehicles,
    drivers: own.length,
    pickedUp,
    late,
    short,
  };
}

// ---------------------------------------------------------------------------
// Next 3 hours for one hospital: how the recovery ward will fill or empty.
// Uses the expected ready times the doctors already set.
// ---------------------------------------------------------------------------

export interface WardForecast {
  waiting: number; // ready, no car on the way yet
  onTheWay: number; // car assigned or accepted
  hours: number[]; // expected to become ready in hour 1, 2, 3 (overdue counts in hour 1)
  noTime: number; // in treatment, no ready time yet (under observation or not diagnosed)
}

export function wardForecast(hospitalId: string, pilgrims: Pilgrim[], now: number): WardForecast {
  const here = pilgrims.filter((p) => p.hospitalId === hospitalId);
  const hours = [0, 0, 0];
  let noTime = 0;
  for (const p of here) {
    if (p.status !== "in_treatment") continue;
    if (!p.expectedReadyAt) {
      noTime++;
      continue;
    }
    const h = Math.floor((p.expectedReadyAt - now) / (60 * MIN));
    if (h < 3) hours[Math.max(0, h)]++;
  }
  return {
    waiting: here.filter((p) => p.status === "ready" || p.status === "ride_requested").length,
    onTheWay: here.filter((p) => p.status === "assigned" || p.status === "accepted").length,
    hours,
    noTime,
  };
}

// ---------------------------------------------------------------------------
// Busiest pickup hours: when pilgrims become ready to leave, by hour of day.
// ---------------------------------------------------------------------------

// SAMPLE season distribution (pilgrims ready per hour, whole season). Not real data.
export const READY_BY_HOUR_SAMPLE = [6, 4, 3, 2, 3, 6, 11, 17, 24, 29, 33, 38, 44, 47, 43, 37, 31, 28, 30, 33, 27, 19, 12, 8];

/** Pilgrims who became ready today in each hour (from the cases in the app). */
export function readyByHourToday(pilgrims: Pilgrim[]) {
  const out = new Array(24).fill(0);
  for (const p of pilgrims) if (p.pickup?.requestedAt) out[new Date(p.pickup.requestedAt).getHours()]++;
  return out;
}

/** The two busiest hours, busiest first. */
export function busiestHours(counts: number[]) {
  return counts
    .map((n, h) => ({ n, h }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .map((x) => x.h);
}

// ---------------------------------------------------------------------------
// Today's report for one hospital, from the timestamps Rabt already records.
// ---------------------------------------------------------------------------

export interface DayReport {
  left: number; // pilgrims who left the hospital today through Rabt
  avgWait: number | null; // minutes from ready to leaving
  maxWait: number | null;
  late: number; // pickups that missed the promised arrival time
  escalated: number; // pickups that needed a reminder
  problems: number;
  fixed: number;
  stillWaiting: number; // ready now, not yet collected
}

export function dayReport(hospitalId: string, pilgrims: Pilgrim[], now: number): DayReport {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const here = pilgrims.filter((p) => p.hospitalId === hospitalId);
  const left = here.filter((p) => p.pickup?.pickedUpAt && p.pickup.pickedUpAt >= t0);
  const waits = left.map((p) => round(p.pickup!.pickedUpAt! - p.pickup!.requestedAt));
  const today = here.filter((p) => p.pickup && p.pickup.requestedAt >= t0);
  const complaints = here.flatMap((p) => (p.complaints ?? []).filter((c) => c.at >= t0));
  return {
    left: left.length,
    avgWait: avg(waits),
    maxWait: waits.length ? Math.max(...waits) : null,
    late: today.filter((p) => p.pickup!.lateAlertSent || (p.pickup!.pickedUpAt && p.pickup!.eta && p.pickup!.pickedUpAt > p.pickup!.eta)).length,
    escalated: today.filter((p) => (p.pickup!.escalation ?? 0) > 0).length,
    problems: complaints.length,
    fixed: complaints.filter((c) => c.resolvedAt).length,
    stillWaiting: here.filter((p) => ["ready", "ride_requested", "assigned", "accepted"].includes(p.status)).length,
  };
}
