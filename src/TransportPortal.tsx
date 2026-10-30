import React, { useState } from "react";
import { LuAccessibility, LuPhone } from "react-icons/lu";
import type { Pilgrim } from "./types";
import { fmtTime, isLate, minutes, useStore } from "./store";
import { EmptyRow, PageHeader, Section, StatusText } from "./ui";
import { suggestChoice } from "./eta";
import { useT } from "./i18n";

type Tab = "driver" | "dispatch";

export default function TransportPortal({ tab, driverId }: { tab: Tab; driverId: string }) {
  return tab === "driver" ? <DriverApp driverId={driverId} /> : <Dispatch />;
}

// ---------------------------------------------------------------------------
// Driver app. Built for a phone; on a laptop it sits in a phone-sized frame
// next to the driver's trip log.

function DriverApp({ driverId }: { driverId: string }) {
  const { state, driver, company, hospital, now } = useStore();
  const { t, p: pn } = useT();
  const d = driver(driverId)!;
  const trips = state.pilgrims.filter((p) => p.pickup?.driverId === driverId);
  const active = trips.filter((p) => ["assigned", "accepted", "picked_up"].includes(p.status)).sort((a, b) => a.pickup!.assignedAt! - b.pickup!.assignedAt!);
  const log = [...trips].sort((a, b) => (b.pickup?.assignedAt ?? 0) - (a.pickup?.assignedAt ?? 0));

  return (
    <div className="page">
      <PageHeader title={t("Driver app")} meta={<>{pn(d.name)} · {pn(d.vehicle)} <span className="mono">{d.plate}</span> · {d.companyId ? pn(company(d.companyId).name) : t("Fleet partner")}</>} />
      <div className="driver-layout">
        <div className="phone" aria-label={t("Driver phone screen")}>
          <div className="phone-status">
            <span className="mono">{fmtTime(now)}</span>
            <span>{t("Rabt Driver")}</span>
          </div>
          <div className="phone-body">
            {active.length ? active.map((p) => <Trip key={p.id} p={p} now={now} />) : <p className="phone-empty">{t("No trips right now. New pickups appear here when they are assigned to you.")}</p>}
          </div>
        </div>

        <Section title={t("Trip log")} count={log.length}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Pilgrim")}</th>
                  <th>{t("From")}</th>
                  <th className="r">{t("Accepted")}</th>
                  <th className="r">{t("Picked up")}</th>
                  <th className="r">{t("Arrived")}</th>
                </tr>
              </thead>
              <tbody>
                {log.map((p) => (
                  <tr key={p.id}>
                    <td className="name">{pn(p.name)}</td>
                    <td>{pn(hospital(p.hospitalId).name)}</td>
                    <td className="mono r">{p.pickup?.acceptedAt ? fmtTime(p.pickup.acceptedAt) : "–"}</td>
                    <td className="mono r">{p.pickup?.pickedUpAt ? fmtTime(p.pickup.pickedUpAt) : "–"}</td>
                    <td className="mono r">{p.pickup?.arrivedAt ? fmtTime(p.pickup.arrivedAt) : "–"}</td>
                  </tr>
                ))}
                {!log.length && <EmptyRow cols={5} text={t("No trips yet.")} />}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

const ETA_CHOICES = [10, 15, 20, 30];

function Trip({ p, now }: { p: Pilgrim; now: number }) {
  const { hospital, accept, pickedUp, arrived, company, etaFor } = useStore();
  const { t, p: pn } = useT();
  const h = hospital(p.hospitalId);
  const est = p.pickup?.estimateMin ?? etaFor(p.pickup!.driverId!, p.hospitalId).minutes;
  const [eta, setEta] = useState(() => suggestChoice(est, ETA_CHOICES));
  const late = isLate(p, now);
  const step = p.status === "assigned" ? "New pickup" : p.status === "accepted" ? "Go to hospital" : "Take to accommodation";
  return (
    <article className={`trip ${late ? "trip-late" : ""}`}>
      <div className="trip-step">{t(step)}</div>
      <div className="trip-name">{pn(p.name)}</div>
      <div className="trip-co">{pn(company(p.companyId).name)}</div>
      <dl className="trip-legs">
        <dt>{t("From")}</dt>
        <dd>
          {t("{hospital}, recovery ward", { hospital: h.name })}
          <span className="mono trip-phone" dir="ltr">
            <LuPhone aria-hidden="true" /> {h.wardPhone}
          </span>
        </dd>
        <dt>{t("To")}</dt>
        <dd>{pn(p.accommodation)}</dd>
      </dl>
      {p.checklist?.mobility === "wheelchair" && (
        <div className="trip-flag">
          <LuAccessibility aria-hidden="true" /> {t("Wheelchair user")}
        </div>
      )}
      {p.status === "assigned" && (
        <>
          <div className="trip-q">
            {t("I can be at the hospital in")}
            <span className="trip-est">{t("Rabt estimate: {n} min", { n: est })}</span>
          </div>
          <div className="eta" role="radiogroup" aria-label={t("Arrival time")}>
            {ETA_CHOICES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={eta === m} className={eta === m ? "on" : ""} onClick={() => setEta(m)}>
                {t("{n} min", { n: m })}
              </button>
            ))}
          </div>
          <button className="trip-btn" onClick={() => accept(p.id, eta)}>
            {t("Accept pickup")}
          </button>
        </>
      )}
      {p.status === "accepted" && (
        <>
          <p className={`trip-due ${late ? "late" : ""}`}>
            {late ? t("{n} min late. The company has been alerted.", { n: minutes(now - p.pickup!.eta!) }) : t("Due at the hospital {time}", { time: fmtTime(p.pickup!.eta!) })}
          </p>
          <button className="trip-btn" onClick={() => pickedUp(p.id)}>
            {t("Pilgrim picked up")}
          </button>
        </>
      )}
      {p.status === "picked_up" && (
        <button className="trip-btn" onClick={() => arrived(p.id)}>
          {t("Arrived at accommodation")}
        </button>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Fleet dispatch: the licensed transport partner assigns drivers to Rabt rides.

function Dispatch() {
  const { state, now, hospital, company, driver, dispatchAssign, etaFor } = useStore();
  const { t, p: pn } = useT();
  const [pick, setPick] = useState<Record<string, string>>({});
  const partner = state.drivers.filter((d) => d.companyId === null);
  const open = state.pilgrims.filter((p) => p.status === "ride_requested").sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const live = state.pilgrims.filter((p) => p.pickup?.mode === "rabt" && ["assigned", "accepted", "picked_up"].includes(p.status));
  const busy = (id: string) => live.some((p) => p.pickup?.driverId === id);
  const free = partner.filter((d) => !busy(d.id)).length;

  return (
    <div className="page">
      <PageHeader title={t("Fleet dispatch")} meta={t("Licensed transport partner · {a} open · {b} in progress · {c} of {d} drivers free", { a: open.length, b: live.length, c: free, d: partner.length })} />
      <Section title={t("Open ride requests")} count={open.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Pilgrim")}</th>
                <th>{t("Company")}</th>
                <th>{t("Pickup")}</th>
                <th className="r">{t("Waiting")}</th>
                <th>{t("Needs")}</th>
                <th className="actions-col">{t("Driver")}</th>
              </tr>
            </thead>
            <tbody>
              {open.map((p) => {
                const needsChair = p.checklist?.mobility === "wheelchair";
                const sel = pick[p.id] ?? "";
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="name">{pn(p.name)}</span>
                      <div className="dim small">{t("To {place}", { place: p.accommodation })}</div>
                    </td>
                    <td>{pn(company(p.companyId).name)}</td>
                    <td>{pn(hospital(p.hospitalId).name)}</td>
                    <td className="mono r">{t("{n} min", { n: minutes(now - p.pickup!.requestedAt) })}</td>
                    <td>{needsChair ? <span className="t-blue"><LuAccessibility aria-hidden="true" /> {t("Wheelchair")}</span> : <span className="dim">{t("Walking")}</span>}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <label className="sr-only" htmlFor={`dispatch-${p.id}`}>
                          {t("Driver for {name}", { name: p.name })}
                        </label>
                        <select id={`dispatch-${p.id}`} className="select sm" value={sel} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                          <option value="">{t("Choose driver")}</option>
                          {[...partner]
                            .sort((a, b) => etaFor(a.id, p.hospitalId).minutes - etaFor(b.id, p.hospitalId).minutes)
                            .map((d) => (
                              <option key={d.id} value={d.id} disabled={needsChair && !d.wheelchair}>
                                {pn(d.name)} · {t("{n} min", { n: etaFor(d.id, p.hospitalId).minutes })}
                                {d.wheelchair ? t(" · accessible") : ""}
                                {busy(d.id) ? t(" · on a trip") : ""}
                              </option>
                            ))}
                        </select>
                        <button className="btn primary sm" disabled={!sel} onClick={() => dispatchAssign(p.id, sel)}>
                          {t("Assign")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!open.length && <EmptyRow cols={6} text={t("No open requests. Companies on the Full plan request rides from their pickup screen.")} />}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={t("In progress")} count={live.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Pilgrim")}</th>
                <th>{t("Driver")}</th>
                <th>{t("From")}</th>
                <th className="r">{t("Due")}</th>
                <th>{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {live.map((p) => (
                <tr key={p.id}>
                  <td className="name">{pn(p.name)}</td>
                  <td>{pn(driver(p.pickup?.driverId)?.name ?? "")}</td>
                  <td>{pn(hospital(p.hospitalId).name)}</td>
                  <td className="mono r">{p.status === "accepted" && p.pickup?.eta ? fmtTime(p.pickup.eta) : "–"}</td>
                  <td>
                    <StatusText p={p} now={now} />
                  </td>
                </tr>
              ))}
              {!live.length && <EmptyRow cols={5} text={t("No rides in progress.")} />}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
