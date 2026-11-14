import React, { useEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { useT } from "./i18n";
import { PageHeader } from "./ui";
import { useStore } from "./store";
import { SEASON_SAMPLE, READY_BY_HOUR_SAMPLE, accuracySummary, busiestHours, readyByHourToday, scoreToday } from "./insights";
import { ReadinessCard } from "./Readiness";

// ---------------------------------------------------------------------------
// Impact: a recovery-ward crowding simulator. ILLUSTRATIVE ONLY. The arrival
// profile and the default response times are our assumptions, not measurements.
// A pilgrim who is ready waits in the ward until the company's vehicle arrives,
// so the number waiting at time t is everyone who became ready in the last R
// minutes (R = response time).
// ---------------------------------------------------------------------------

// relative share of pilgrims becoming ready in each hour (busy in the afternoon
// heat and after the evening prayers, quiet at night)
const PROFILE = [0.3, 0.25, 0.2, 0.2, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.0, 1.9, 1.7, 1.4, 1.2, 1.1, 1.2, 1.3, 1.1, 0.7, 0.45];
const MEAN = PROFILE.reduce((a, b) => a + b, 0) / PROFILE.length;
const STEP_MIN = 15;
const POINTS = (24 * 60) / STEP_MIN; // one point every 15 minutes

function waitingCurve(perDay: number, responseMin: number) {
  // patients becoming ready in each 15-minute slot
  const slot = Array.from({ length: POINTS }, (_, i) => (perDay / 24) * (PROFILE[Math.floor((i * STEP_MIN) / 60)] / MEAN) * (STEP_MIN / 60));
  const back = responseMin / STEP_MIN;
  return slot.map((_, i) => {
    // sum the last `back` slots (wrapping round midnight: the day repeats)
    let total = 0;
    const whole = Math.floor(back);
    for (let k = 0; k < whole; k++) total += slot[(i - k + POINTS) % POINTS];
    total += (back - whole) * slot[(i - whole + POINTS) % POINTS];
    return total;
  });
}

const hh = (i: number) => {
  const m = i * STEP_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function ImpactPage() {
  const { t } = useT();
  const [perDay, setPerDay] = useState(120);
  const [today, setToday] = useState(110);
  const [rabt, setRabt] = useState(35);
  const withRabt = Math.min(rabt, today);

  const a = useMemo(() => waitingCurve(perDay, today), [perDay, today]);
  const b = useMemo(() => waitingCurve(perDay, withRabt), [perDay, withRabt]);
  const peakA = Math.max(...a);
  const peakB = Math.max(...b);
  const hoursFreed = (perDay * (today - withRabt)) / 60;
  const cut = today > 0 ? Math.round(((today - withRabt) / today) * 100) : 0;

  return (
    <div className="page">
      <PageHeader title={t("Impact")} meta={t("How many pilgrims wait in the recovery ward through the day, today and with Rabt.")} />

      <div className="note amber small">{t("Illustrative, based on our assumptions. Not measured data. Move the sliders to test other numbers.")}</div>

      <div className="sliders">
        <Slider label={t("Pilgrims ready for pickup per day")} value={perDay} min={20} max={300} step={10} onChange={setPerDay} unit="" />
        <Slider label={t("Time until the company's vehicle arrives, today")} value={today} min={30} max={240} step={5} onChange={setToday} unit={t("min")} />
        <Slider label={t("Time until the vehicle arrives, with Rabt")} value={rabt} min={10} max={120} step={5} onChange={setRabt} unit={t("min")} />
      </div>

      <div className="stat-row">
        <Stat label={t("Busiest moment, today")} value={Math.round(peakA)} unit={t("pilgrims waiting")} />
        <Stat label={t("Busiest moment, with Rabt")} value={Math.round(peakB)} unit={t("pilgrims waiting")} />
        <Stat label={t("Ward time freed per day")} value={Math.round(hoursFreed)} unit={t("bed-hours")} />
        <Stat label={t("Shorter wait per pilgrim")} value={cut} unit="%" />
      </div>

      <WaitChart a={a} b={b} />
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void }) {
  const id = useRef("s" + Math.random().toString(36).slice(2, 8)).current;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono strong">
          {value} {unit}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        <span className="mono">{value}</span> <span className="stat-unit">{unit}</span>
      </span>
    </div>
  );
}

// line chart: x = time of day, y = pilgrims waiting. Hover shows both values.
function WaitChart({ a, b }: { a: number[]; b: number[] }) {
  const { t } = useT();
  // draw at the real on-screen width so text stays readable on a phone
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const H = narrow ? 220 : 280;
  const pad = { l: 34, r: 12, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const top = niceMax(Math.max(...a, ...b, 1));
  const x = (i: number) => pad.l + (i / (a.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const path = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (a.length - 1));
    setHover(i < 0 || i >= a.length ? null : i);
  };

  return (
    <section className="chart-card" aria-label={t("Pilgrims waiting in the recovery ward")}>
      <div className="chart-head">
        <h2>{t("Pilgrims waiting in the recovery ward")}</h2>
        <div className="legend">
          <span className="legend-item">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" className="ln-today" />
            </svg>
            {t("Today")}
          </span>
          <span className="legend-item">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" className="ln-rabt" />
            </svg>
            {t("With Rabt")}
          </span>
        </div>
      </div>
      <div className="chart-box" dir="ltr" ref={boxRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t("Line chart of pilgrims waiting through the day")} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={pad.l - 8} y={y(v) + 4} className="axis" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {(narrow ? [0, 6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21]).map((h) => (
            <text key={h} x={x((h * 60) / STEP_MIN)} y={H - 8} className="axis" textAnchor="middle">
              {String(h).padStart(2, "0")}:00
            </text>
          ))}
          <path d={path(a)} className="ln-today" />
          <path d={path(b)} className="ln-rabt" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
              <circle cx={x(hover)} cy={y(a[hover])} r="4.5" className="dot-today" />
              <circle cx={x(hover)} cy={y(b[hover])} r="4.5" className="dot-rabt" />
            </g>
          )}
        </svg>
        {hover != null && (
          <div className="chart-tip" style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 18), 82)}%` }}>
            <b className="mono">{hh(hover)}</b>
            <span>
              <i className="sw sw-today" /> {t("Today")}: <b className="mono">{Math.round(a[hover])}</b>
            </span>
            <span>
              <i className="sw sw-rabt" /> {t("With Rabt")}: <b className="mono">{Math.round(b[hover])}</b>
            </span>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>{t("Show as table")}</summary>
        <table className="table">
          <thead>
            <tr>
              <th>{t("Time")}</th>
              <th className="r">{t("Today")}</th>
              <th className="r">{t("With Rabt")}</th>
            </tr>
          </thead>
          <tbody>
            {a.map((v, i) =>
              i % 4 === 0 ? (
                <tr key={i}>
                  <td className="mono">{hh(i)}</td>
                  <td className="r mono">{Math.round(v)}</td>
                  <td className="r mono">{Math.round(b[i])}</td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function niceMax(v: number) {
  const step = v <= 8 ? 2 : v <= 20 ? 5 : v <= 40 ? 10 : v <= 100 ? 20 : 50;
  return Math.ceil(v / step) * step;
}

// ---------------------------------------------------------------------------
// Who sees what: the privacy rules the prototype already follows, on one page.
// ---------------------------------------------------------------------------

const ROWS: { item: string; h: boolean; c: boolean; d: boolean; f: boolean }[] = [
  { item: "Pilgrim's name", h: true, c: true, d: true, f: true },
  { item: "ID number and nationality", h: true, c: true, d: false, f: false },
  { item: "Which hospital and ward", h: true, c: true, d: true, f: true },
  { item: "Diagnosis and clinical notes", h: true, c: false, d: false, f: false },
  { item: "Expected ready time", h: true, c: true, d: false, f: false },
  { item: "Mobility needs (wheelchair, stretcher)", h: true, c: true, d: true, f: false },
  { item: "Accommodation address", h: true, c: true, d: true, f: false },
  { item: "Ward phone number", h: true, c: true, d: true, f: false },
  { item: "Pickup status and times", h: true, c: true, d: true, f: true },
];

export function PrivacyPage() {
  const { t } = useT();
  const mark = (on: boolean) =>
    on ? (
      <span className="yes">
        <LuCheck aria-hidden="true" /> {t("Sees")}
      </span>
    ) : (
      <span className="no">
        <LuX aria-hidden="true" /> {t("Never")}
      </span>
    );
  return (
    <div className="page">
      <PageHeader title={t("Who sees what")} meta={t("Intended permissions for a live rollout. Demo roles share sample data in this browser.")} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Information")}</th>
              <th>{t("Hospital")}</th>
              <th>{t("Company")}</th>
              <th>{t("Driver")}</th>
              <th>{t("Family")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.item}>
                <td className="strong">{t(r.item)}</td>
                <td>{mark(r.h)}</td>
                <td>{mark(r.c)}</td>
                <td>{mark(r.d)}</td>
                <td>{mark(r.f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="promise-grid">
        <div className="promise">
          <h2>{t("The diagnosis never leaves the hospital")}</h2>
          <p className="dim">{t("The company gets an expected ready time, not the reason. SMS messages never contain medical details.")}</p>
        </div>
        <div className="promise">
          <h2>{t("Every step is recorded")}</h2>
          <p className="dim">{t("Each action is saved with the time and who did it, so any delay or mistake can be traced.")}</p>
        </div>
        <div className="promise">
          <h2>{t("Kept only as long as needed")}</h2>
          <p className="dim">{t("In a live version, pickup records are deleted after a set period, in line with Saudi Arabia's Personal Data Protection Law (PDPL).")}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company scorecard: how fast each company responds, from Rabt's timestamps.
// Season figures are SAMPLE data; "today" comes from the cases in the app.
// ---------------------------------------------------------------------------

export function ScorecardPage() {
  const { t, p: pn } = useT();
  const { state } = useStore();
  const acc = accuracySummary(state.pilgrims);
  const n = (v: number | null, unit: "min" | "%") => (v == null ? "–" : unit === "min" ? t("{n} min", { n: v }) : `${v}%`);
  return (
    <div className="page">
      <PageHeader title={t("Company scorecard")} meta={t("How quickly each company collects its pilgrims, worked out from the times Rabt records.")} />
      <h2 className="sec-title">{t("Readiness right now")}</h2>
      <div className="ready-grid">
        {state.companies.map((c) => (
          <ReadinessCard key={c.id} companyId={c.id} compact />
        ))}
      </div>

      <h2 className="sec-title">{t("Season so far")}</h2>
      <div className="note amber small">{t("Season figures are sample data. Today's figures come from the cases in this demo.")}</div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Company")}</th>
              <th className="r">{t("Pickups")}</th>
              <th className="r">{t("Avg. response")}</th>
              <th className="r">{t("Avg. ward wait")}</th>
              <th className="r">{t("Late arrivals")}</th>
              <th className="r">{t("Needed reminders")}</th>
            </tr>
          </thead>
          <tbody>
            {state.companies.map((c) => {
              const s = SEASON_SAMPLE[c.id];
              const d = scoreToday(c, state.pilgrims);
              const bad = (s?.responseMin ?? 0) > 15;
              return (
                <tr key={c.id}>
                  <td className="strong">
                    {pn(c.name)}
                    <div className="dim small">{t(c.plan === "full" ? "Full plan" : "Basic plan")}</div>
                  </td>
                  <td className="mono r">
                    {s?.pickups ?? "–"}
                    <div className="dim small">{t("today {n}", { n: d.pickups })}</div>
                  </td>
                  <td className={`mono r ${bad ? "txt-red" : ""}`}>
                    {n(s?.responseMin ?? null, "min")}
                    <div className="dim small">{t("today {n}", { n: n(d.responseMin, "min") })}</div>
                  </td>
                  <td className="mono r">
                    {n(s?.waitMin ?? null, "min")}
                    <div className="dim small">{t("today {n}", { n: n(d.waitMin, "min") })}</div>
                  </td>
                  <td className="mono r">
                    {n(s?.lateRate ?? null, "%")}
                    <div className="dim small">{t("today {n}", { n: n(d.lateRate, "%") })}</div>
                  </td>
                  <td className="mono r">
                    {s?.escalated ?? "–"}
                    <div className="dim small">{t("today {n}", { n: d.escalated })}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dim small">{t("Response = from ready for transport to a vehicle assigned. Ward wait = from ready to leaving the hospital. Reminders start when no vehicle is sent within 10 minutes.")}</p>

      <BusiestHours />

      <div className="promise-grid">
        <div className="promise">
          <h2>{t("Estimate vs actual")}</h2>
          <p className="dim">
            {acc.readyErr == null
              ? t("No closed cases yet.")
              : t("Ready time (EPRT) was off by {n} min on average over {k} cases.", { n: acc.readyErr, k: acc.readyCases })}
          </p>
          <p className="dim">
            {acc.travelErr == null ? "" : t("Vehicle travel time was off by {n} min on average over {k} cases.", { n: acc.travelErr, k: acc.travelCases })}
          </p>
        </div>
        <div className="promise">
          <h2>{t("How Rabt learns")}</h2>
          <p className="dim">{t("Every case records the estimate and what really happened. After one season, the typical stay per condition and the travel times come from real cases at each hospital, instead of sample figures.")}</p>
        </div>
        <div className="promise">
          <h2>{t("Who uses this")}</h2>
          <p className="dim">{t("Each company sees only its own score, so it can fix slow pickups itself. Hospitals see response times for their own patients. Nothing is sent to the Ministry.")}</p>
        </div>
      </div>
    </div>
  );
}

// Busiest pickup hours: sample season bars, with today's cases marked on top
function BusiestHours() {
  const { t } = useT();
  const { state } = useStore();
  const season = READY_BY_HOUR_SAMPLE;
  const today = readyByHourToday(state.pilgrims);
  const [a, b] = busiestHours(season);
  const max = Math.max(...season);
  const W = 720, H = 200, padB = 24, padX = 22, bw = (W - 2 * padX) / 24;
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <section className="chart-card hours-card" aria-label={t("Busiest pickup hours")}>
      <div className="chart-head">
        <h2>{t("Busiest pickup hours")}</h2>
        <span className="note amber small">{t("Season bars are sample data. Dots are today's cases.")}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t("Pilgrims ready to leave by hour of day")}>
        {season.map((n, h) => {
          const bh = ((H - padB - 10) * n) / max;
          const top = h === a || h === b;
          return (
            <g key={h}>
              <rect x={padX + h * bw + 3} y={H - padB - bh} width={bw - 6} height={bh} rx="3" className={top ? "bar-top" : "bar"} />
              {today[h] > 0 && <circle cx={padX + h * bw + bw / 2} cy={H - padB - bh - 9} r="4" className="bar-dot" />}
              {h % 3 === 0 && (
                <text x={padX + h * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                  {hh(h)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="strong">{t("Most pilgrims become ready between {a} and {b}. Keep a car free around those hours.", { a: hh(Math.min(a, b)), b: hh(Math.max(a, b) + 1) })}</p>
    </section>
  );
}
