import React from "react";
import { useStore, fmtTime } from "./store";
import { useT } from "./i18n";
import { wardForecast } from "./insights";

const HOUR = 3_600_000;

// Hospital: how many pilgrims will be ready to leave in each of the next three hours
export function WardForecastCard({ hospitalId }: { hospitalId: string }) {
  const { state, now } = useStore();
  const { t } = useT();
  const f = wardForecast(hospitalId, state.pilgrims, now);
  const max = Math.max(1, ...f.hours);
  const next = f.hours[0];
  const summary =
    next === 0 && f.waiting === 0
      ? t("Nobody expected ready in the next hour.")
      : t("{n} expected ready in the next hour, {w} waiting now, {c} cars already on the way.", { n: next, w: f.waiting, c: f.onTheWay });
  return (
    <section className="forecast" aria-label={t("Next 3 hours")}>
      <div className="forecast-head">
        <span className="label">{t("Next 3 hours")}</span>
        <span className="dim small">{t("From the expected ready times set by doctors")}</span>
      </div>
      <div className="forecast-grid">
        <div className="fc-now">
          <div className="fc-num mono">{f.waiting}</div>
          <div className="small">{t("Waiting for pickup now")}</div>
          <div className="dim small">{t("{n} cars on the way", { n: f.onTheWay })}</div>
        </div>
        {f.hours.map((n, i) => (
          <div key={i} className="fc-hour">
            <div className="fc-bar" aria-hidden="true">
              <span style={{ blockSize: `${(n / max) * 100}%` }} />
            </div>
            <div className="fc-num mono">{n}</div>
            <div className="dim small mono" dir="ltr">
              {fmtTime(now + i * HOUR)}–{fmtTime(now + (i + 1) * HOUR)}
            </div>
          </div>
        ))}
        <div className="fc-now">
          <div className="fc-num mono">{f.noTime}</div>
          <div className="small">{t("No ready time yet")}</div>
          <div className="dim small">{t("Under observation or not yet diagnosed")}</div>
        </div>
      </div>
      <p className="forecast-sum">{summary}</p>
    </section>
  );
}
