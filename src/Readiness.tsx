import React from "react";
import { useStore } from "./store";
import { useT } from "./i18n";
import { readinessOf } from "./insights";

// Company readiness card: is the company ready to collect everyone expected out soon?
export function ReadinessCard({ companyId, compact = false }: { companyId: string; compact?: boolean }) {
  const { state, now, company } = useStore();
  const { t, p } = useT();
  const c = company(companyId);
  const r = readinessOf(companyId, state, now);
  const badge = { good: t("Ready to collect"), watch: t("Needs attention"), risk: t("At risk") }[r.level];
  const advice =
    r.level === "good"
      ? t("Enough free vehicles for everyone expected out in the next hour.")
      : r.short > 0
        ? c.plan === "full"
          ? t("{n} more vehicles needed in the next hour. Call in drivers or request Rabt rides.", { n: r.short })
          : t("{n} more vehicles needed in the next hour. Call in drivers now.", { n: r.short })
        : t("Vehicles running late. Check with the drivers.");
  const rows: [string, number, boolean?][] = [
    [t("Expected out in the next hour"), r.expected],
    [t("Waiting for pickup now"), r.waiting, r.waiting > 0],
    [t("Free vehicles"), r.vehicles],
    [t("Drivers on duty"), r.drivers],
    [t("Picked up today"), r.pickedUp],
    [t("Running late"), r.late, r.late > 0],
  ];
  return (
    <div className={`ready-card lvl-${r.level} ${compact ? "compact" : ""}`} data-ready={companyId}>
      <div className="ready-head">
        <div>
          {compact && <div className="ready-co">{p(c.name)}</div>}
          <div className="label">{t("Pickup readiness, next hour")}</div>
          <div className="ready-score">
            {r.expected === 0
              ? t("No pickups expected")
              : t("Can collect {v} of {e}", { v: Math.min(r.vehicles, r.expected), e: r.expected })}
          </div>
        </div>
        <span className={`ready-badge b-${r.level}`}>{badge}</span>
      </div>
      {r.expected > 0 && (
        <div className="ready-dots" role="img" aria-label={t("{v} of {e} pilgrims covered by a free vehicle", { v: Math.min(r.vehicles, r.expected), e: r.expected })}>
          {Array.from({ length: Math.min(r.expected, 12) }, (_, i) => (
            <span key={i} className={i < r.vehicles ? "dot on" : "dot"} />
          ))}
          <span className="dim small ready-dots-key">{t("● has a car  ○ needs a car")}</span>
        </div>
      )}
      {!compact && (
        <dl className="ready-rows">
          {rows.map(([k, v, warn]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={`mono ${warn ? "warn" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className={`ready-advice ${r.level !== "good" ? "strong" : "dim"}`}>{advice}</p>
      {!compact && <p className="dim small">{t("Pilgrims expected out in the next hour (waiting now, or due ready within the hour) compared with free vehicles. Late vehicles are shown separately.")}</p>}
    </div>
  );
}
