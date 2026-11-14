import React from "react";
import { LuPrinter } from "react-icons/lu";
import { useStore } from "./store";
import { useT } from "./i18n";
import { PageHeader } from "./ui";
import { dayReport } from "./insights";

// Hospital: one page summing up today's pickups, worked out from Rabt's timestamps
export function DailyReport({ hospitalId }: { hospitalId: string }) {
  const { state, now, hospital } = useStore();
  const { t, p: pn, dur, lang } = useT();
  const r = dayReport(hospitalId, state.pilgrims, now);
  const date = new Date(now).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const rows: [string, string, boolean?][] = [
    [t("Left the hospital through Rabt"), String(r.left)],
    [t("Average wait from ready to leaving"), r.avgWait == null ? "–" : dur(r.avgWait)],
    [t("Longest wait"), r.maxWait == null ? "–" : dur(r.maxWait), (r.maxWait ?? 0) > 60],
    [t("Late pickups"), String(r.late), r.late > 0],
    [t("Pickups that needed a reminder"), String(r.escalated), r.escalated > 0],
    [t("Problems reported"), String(r.problems)],
    [t("Problems fixed"), `${r.fixed} / ${r.problems}`, r.fixed < r.problems],
    [t("Still waiting for pickup now"), String(r.stillWaiting)],
  ];
  return (
    <div className="page report-page">
      <PageHeader
        title={t("Today's report")}
        meta={`${pn(hospital(hospitalId).name)} · ${date}`}
        actions={
          <button className="btn no-print" onClick={() => window.print()}>
            <LuPrinter aria-hidden="true" /> {t("Print")}
          </button>
        }
      />
      <div className="report-grid">
        {rows.map(([k, v, warn]) => (
          <div key={k} className="report-cell">
            <div className={`report-num mono ${warn ? "txt-red" : ""}`}>{v}</div>
            <div className="small">{k}</div>
          </div>
        ))}
      </div>
      <p className="dim small">{t("Worked out automatically from the times Rabt records. Nurses don't type anything extra. Sample data in this prototype.")}</p>
    </div>
  );
}
