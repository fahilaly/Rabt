import React, { useEffect, useState } from "react";
import { LuAccessibility } from "react-icons/lu";
import type { Driver, Hospital, Pilgrim } from "./types";
import { liveEta, type Eta } from "./eta";
import { ReadinessCard } from "./Readiness";
import { FamilyButton } from "./Family";
import { WAITING, fmtTime, isLate, minutes, useStore } from "./store";
import { useT, type T } from "./i18n";
import { Drawer, EmptyRow, Modal, PageHeader, PrivacyNote, Section, StatusText, Steps, Timeline } from "./ui";

type Tab = "requests" | "pilgrims" | "history";

export default function CompanyPortal({ companyId, tab, openId, setOpenId }: {
  companyId: string; tab: Tab; openId: string | null; setOpenId: (id: string | null) => void;
}) {
  const { state, now } = useStore();
  const { t } = useT();
  const [assignFor, setAssignFor] = useState<Pilgrim | null>(null);
  const mine = state.pilgrims.filter((p) => p.companyId === companyId);
  const late = mine.filter((p) => isLate(p, now));
  const open = mine.find((p) => p.id === openId) ?? null;

  return (
    <>
      {late.length > 0 && (
        <div className="alert-bar" role="alert">
          <span>
            <b>{late.length === 1 ? t("Vehicle late for {name}.", { name: late[0].name }) : t("{n} vehicles are late.", { n: late.length })}</b> {t("The hospital can see the delay on its ward board.")}
          </span>
          <button className="link" onClick={() => setOpenId(late[0].id)}>
            {t("Open")}
          </button>
        </div>
      )}
      {tab === "requests" && <Requests companyId={companyId} list={mine} onOpen={setOpenId} onAssign={setAssignFor} />}
      {tab === "pilgrims" && <InHospital list={mine} onOpen={setOpenId} />}
      {tab === "history" && <History list={mine} onOpen={setOpenId} />}
      <CompanyDrawer p={open} onClose={() => setOpenId(null)} onAssign={setAssignFor} />
      <AssignModal p={assignFor} companyId={companyId} onClose={() => setAssignFor(null)} />
    </>
  );
}

function Requests({ companyId, list, onOpen, onAssign }: { companyId: string; list: Pilgrim[]; onOpen: (id: string) => void; onAssign: (p: Pilgrim) => void }) {
  const { now, hospital, company, driver } = useStore();
  const T = useT();
  const { t, p: pn } = T;
  const c = company(companyId);
  const needs = list.filter((p) => p.status === "ready").sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const moving = list.filter((p) => ["ride_requested", "assigned", "accepted", "picked_up"].includes(p.status)).sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const inTreatment = list.filter((p) => p.status === "in_treatment").length;
  const soon = list.filter((p) => p.status === "in_treatment").sort((a, b) => (a.expectedReadyAt ?? Infinity) - (b.expectedReadyAt ?? Infinity));

  return (
    <div className="page">
      <PageHeader
        title={t("Pickup requests")}
        meta={t(c.plan === "full" ? "{company} · Full plan, Rabt rides available · {n} still in treatment" : "{company} · Basic plan, own vehicles · {n} still in treatment", { company: c.name, n: inTreatment })}
      />

      <ReadinessCard companyId={c.id} />

      <CompanyComplaints companyId={c.id} onOpen={onOpen} />

      <Section title={t("Need a vehicle")} count={needs.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Pilgrim")}</th>
                <th>{t("Hospital")}</th>
                <th className="r">{t("Ready")}</th>
                <th className="r">{t("Waiting")}</th>
                <th>{t("Needs")}</th>
                <th className="actions-col">
                  <span className="sr-only">{t("Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {needs.map((p) => {
                const h = hospital(p.hospitalId);
                const wait = minutes(now - p.pickup!.requestedAt);
                return (
                  <tr data-pid={p.id} key={p.id}>
                    <td>
                      <button className="link name" onClick={() => onOpen(p.id)}>
                        {pn(p.name)}
                      </button>
                      <div className="dim small">{t("To {place}", { place: p.accommodation })}</div>
                    </td>
                    <td>
                      {pn(h.name)}
                      <div className="dim small mono">{t("Ward {phone}", { phone: h.wardPhone })}</div>
                    </td>
                    <td className="mono r">{fmtTime(p.pickup!.requestedAt)}</td>
                    <td className={`mono r ${wait >= 15 ? "t-amber strong" : ""}`}>
                      {t("{n} min", { n: wait })}
                      {(p.pickup?.escalation ?? 0) > 0 && <div className="esc-note">{t(["reminder sent", "2nd contact alerted", "Rabt ride offered"][p.pickup!.escalation! - 1])}</div>}
                    </td>
                    <td>{p.checklist?.mobility === "wheelchair" ? <span className="t-blue"><LuAccessibility aria-hidden="true" /> {t("Wheelchair")}</span> : <span className="dim">{t("Walking")}</span>}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button className="btn primary sm" onClick={() => onAssign(p)}>
                          {t("Send our vehicle")}
                        </button>
                        <RideButton p={p} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!needs.length && <EmptyRow cols={6} text={t("No pickups waiting. New requests appear here when a hospital confirms a pilgrim is ready.")} />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t("In progress")} count={moving.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Pilgrim")}</th>
                <th>{t("Hospital")}</th>
                <th>{t("Driver")}</th>
                <th className="r">{t("Due")}</th>
                <th>{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {moving.map((p) => {
                const d = driver(p.pickup?.driverId);
                return (
                  <tr data-pid={p.id} key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                    <td className="name">{pn(p.name)}</td>
                    <td>{pn(hospital(p.hospitalId).name)}</td>
                    <td>
                      {d ? pn(d.name) : <span className="dim">{t("Fleet partner assigning")}</span>}
                      {d && <span className="dim">{t(p.pickup?.mode === "rabt" ? " · Rabt ride" : " · own")}</span>}
                    </td>
                    <td className="mono r">{p.status === "accepted" && p.pickup?.eta ? fmtTime(p.pickup.eta) : "–"}</td>
                    <td>
                      <StatusText p={p} now={now} />
                    </td>
                  </tr>
                );
              })}
              {!moving.length && <EmptyRow cols={5} text={t("Nothing in progress.")} />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t("Still in treatment")} count={soon.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Pilgrim")}</th>
                <th>{t("Hospital")}</th>
                <th className="r">{t("Admitted")}</th>
                <th className="r">{t("Expected ready (EPRT)")}</th>
              </tr>
            </thead>
            <tbody>
              {soon.map((p) => (
                <tr data-pid={p.id} key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                  <td className="name">{pn(p.name)}</td>
                  <td>{pn(hospital(p.hospitalId).name)}</td>
                  <td className="mono r">{fmtTime(p.admittedAt)}</td>
                  <td className="r">{expectedCell(p, now, T)}</td>
                </tr>
              ))}
              {!soon.length && <EmptyRow cols={4} text={t("None of your pilgrims are in treatment.")} />}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function expectedCell(p: Pilgrim, now: number, { t, dur }: T) {
  if (!p.expectedReadyAt) return <span className="dim">{t(p.observation ? "Under observation, no time yet" : "Waiting for the doctor")}</span>;
  const diff = minutes(p.expectedReadyAt - now);
  return (
    <>
      <span className="mono">~{fmtTime(p.expectedReadyAt)}</span>
      <span className="dim small">{p.expectedReadyAt > now ? t(" · in {dur}", { dur: dur(diff) }) : t(" · any time now")}</span>
    </>
  );
}

function RideButton({ p }: { p: Pilgrim }) {
  const { company, requestRide } = useStore();
  const { t } = useT();
  const full = company(p.companyId).plan === "full";
  const offered = (p.pickup?.escalation ?? 0) >= 3;
  if (!full && !offered) return <span className="dim small">{t("Rabt ride: Full plan")}</span>;
  return (
    <button className={`btn sm ${offered ? "primary" : ""}`} onClick={() => requestRide(p.id)}>
      {t(full ? "Request Rabt ride" : "Request Rabt ride (pay per ride)")}
    </button>
  );
}

// Ask the optional /api/eta server function for live times; empty when unavailable.
function useLiveEtas(drivers: Driver[], h: Hospital | null) {
  const [live, setLive] = useState<Record<string, Eta>>({});
  const key = (h?.id ?? "") + drivers.map((d) => d.id).join(",");
  useEffect(() => {
    if (!h || !drivers.length) return;
    let on = true;
    Promise.all(drivers.map((d) => liveEta(d, h).then((e) => [d.id, e] as const))).then((rows) => {
      if (!on) return;
      const got: Record<string, Eta> = {};
      rows.forEach(([id, e]) => e && (got[id] = e));
      setLive(got);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return live;
}

// Problems the hospital reported: the company fixes them here, before they go further
function CompanyComplaints({ companyId, onOpen }: { companyId: string; onOpen: (id: string) => void }) {
  const { state, now, resolveComplaint } = useStore();
  const { t, p: pn, dur } = useT();
  const open = state.pilgrims.flatMap((p) => (p.companyId === companyId ? (p.complaints ?? []).filter((c) => !c.resolvedAt).map((c) => ({ p, c })) : []));
  if (!open.length) return null;
  return (
    <Section title={t("Problems to fix")} count={open.length}>
      <ul className="cx-list cx-company">
        {open.map(({ p, c }) => {
          const left = 30 - minutes(now - c.at);
          return (
            <li key={c.id}>
              <div>
                <button className="link strong" onClick={() => onOpen(p.id)}>
                  {pn(p.name)}
                </button>{" "}
                · <b>{t(c.reason)}</b>
                {c.note && <span className="dim"> · {c.note}</span>}
                <div className={`small ${left <= 0 ? "txt-red" : "dim"}`}>
                  {left > 0 ? t("Reply within {dur}", { dur: dur(left) }) : t("Overdue by {dur}", { dur: dur(-left) })}
                </div>
              </div>
              <button className="btn sm primary" onClick={() => resolveComplaint(p.id, c.id, t("Fixed and confirmed with the hospital"))}>
                {t("Mark as fixed")}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function AssignModal({ p, companyId, onClose }: { p: Pilgrim | null; companyId: string; onClose: () => void }) {
  const { state, assignOwn, etaFor: builtIn, hospital } = useStore();
  const { t, p: pn } = useT();
  const [driverId, setDriverId] = useState<string>("");
  const live = useLiveEtas(p ? state.drivers.filter((d) => d.companyId === companyId) : [], p ? hospital(p.hospitalId) : null);
  if (!p) return null;
  const etaFor = (id: string, hid: string) => live[id] ?? builtIn(id, hid);
  const anyLive = Object.keys(live).length > 0;
  const needsChair = p.checklist?.mobility === "wheelchair";
  // wheelchair users: accessible cars first, then by travel time
  const drivers = state.drivers
    .filter((d) => d.companyId === companyId)
    .sort((a, b) => (needsChair ? Number(b.wheelchair) - Number(a.wheelchair) : 0) || etaFor(a.id, p.hospitalId).minutes - etaFor(b.id, p.hospitalId).minutes);
  const busy = (id: string) => state.pilgrims.some((x) => x.pickup?.driverId === id && ["assigned", "accepted", "picked_up"].includes(x.status));
  const chosen = drivers.find((d) => d.id === driverId);

  return (
    <Modal open={!!p} onClose={onClose} title={t("Send a vehicle for {name}", { name: p.name })}>
      {needsChair && (
        <p className="note chair-note">
          <LuAccessibility aria-hidden="true" /> {t("This pilgrim uses a wheelchair. Accessible cars are listed first.")}
        </p>
      )}
      <fieldset className="radios">
        <legend className="label">{t("Driver")}</legend>
        {drivers.map((d) => (
          <label key={d.id} className={`radio driver-opt ${needsChair && !d.wheelchair ? "opt-unsuitable" : ""}`}>
            <input id={`drv-${d.id}`} type="radio" name="driver" checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
            <span>
              {pn(d.name)}
              <span className="dim">
                {" "}
                · {pn(d.vehicle)} · <span className="mono">{d.plate}</span>
                {busy(d.id) ? t(" · on another trip") : ""}
              </span>
              {d.wheelchair && (
                <span className="chair-tag">
                  <LuAccessibility aria-hidden="true" /> {t("Wheelchair accessible")}
                </span>
              )}
              <span className="dim small opt-where">{t("Now at {place}", { place: d.at })}</span>
            </span>
            <span className="opt-eta">
              <span className="mono">{t("{n} min", { n: etaFor(d.id, p.hospitalId).minutes })}</span>
              <span className="dim small">{t("{n} km", { n: etaFor(d.id, p.hospitalId).km })}</span>
            </span>
          </label>
        ))}
        {!drivers.length && <p className="dim">{t("No drivers set up for this company.")}</p>}
      </fieldset>
      {needsChair && chosen && !chosen.wheelchair && <p className="note red">{t("This pilgrim uses a wheelchair and this vehicle isn't marked accessible.")}</p>}
      <p className="dim small">
        {anyLive && <span className="live-tag">{t("Live traffic")}</span>}{" "}
        {t("Times are Rabt's estimate to reach the hospital. The driver confirms an arrival time on their phone, and the hospital sees it on the ward board.")}
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="btn primary"
          disabled={!driverId}
          onClick={() => {
            assignOwn(p.id, driverId, live[driverId]?.minutes);
            setDriverId("");
            onClose();
          }}
        >
          {t("Assign driver")}
        </button>
      </div>
    </Modal>
  );
}

function InHospital({ list, onOpen }: { list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { now, hospital } = useStore();
  const T = useT();
  const { t, p: pn } = T;
  const rows = list.filter((p) => p.status !== "arrived").sort((a, b) => order(a) - order(b));
  return (
    <div className="page">
      <PageHeader title={t("Pilgrims in hospital")} meta={t("Where each of your pilgrims is. Clinical details stay with the hospital.")} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Pilgrim")}</th>
              <th>{t("ID")}</th>
              <th>{t("Hospital")}</th>
              <th>{t("Status")}</th>
              <th className="r">{t("Expected ready (EPRT)")}</th>
              <th className="r">{t("Since")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr data-pid={p.id} key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td>
                  <span className="name">{pn(p.name)}</span>
                  <span className="dim"> · {pn(p.nationality)}</span>
                </td>
                <td className="mono dim">{p.idNumber}</td>
                <td>{pn(hospital(p.hospitalId).name)}</td>
                <td>
                  <StatusText p={p} now={now} />
                </td>
                <td className="r">{p.status === "in_treatment" ? expectedCell(p, now, T) : <span className="dim">{t("Ready")}</span>}</td>
                <td className="mono r">{p.status === "in_treatment" ? fmtTime(p.admittedAt) : fmtTime(p.pickup!.requestedAt)}</td>
              </tr>
            ))}
            {!rows.length && <EmptyRow cols={6} text={t("None of your pilgrims are in hospital.")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function order(p: Pilgrim) {
  return ["ready", "accepted", "assigned", "ride_requested", "picked_up", "in_treatment", "arrived"].indexOf(p.status);
}

function History({ list, onOpen }: { list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { hospital, driver } = useStore();
  const { t, p: pn, dur } = useT();
  const done = list.filter((p) => p.status === "arrived").sort((a, b) => b.pickup!.arrivedAt! - a.pickup!.arrivedAt!);
  const waits = done.map((p) => minutes(p.pickup!.pickedUpAt! - p.pickup!.requestedAt)).sort((a, b) => a - b);
  const mid = Math.floor(waits.length / 2);
  const median = !waits.length ? 0 : waits.length % 2 ? waits[mid] : Math.round((waits[mid - 1] + waits[mid]) / 2);

  return (
    <div className="page">
      <PageHeader title={t("Completed")} meta={done.length ? t("{n} pickups · median wait in the ward {dur}", { n: done.length, dur: dur(median) }) : t("No completed pickups yet")} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Pilgrim")}</th>
              <th>{t("Hospital")}</th>
              <th>{t("Driver")}</th>
              <th className="r">{t("Ready")}</th>
              <th className="r">{t("Picked up")}</th>
              <th className="r">{t("Wait")}</th>
              <th className="r">{t("Arrived")}</th>
            </tr>
          </thead>
          <tbody>
            {done.map((p) => (
              <tr data-pid={p.id} key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td className="name">{pn(p.name)}</td>
                <td>{pn(hospital(p.hospitalId).name)}</td>
                <td>
                  {pn(driver(p.pickup!.driverId)?.name ?? "")}
                  <span className="dim">{t(p.pickup!.mode === "rabt" ? " · Rabt ride" : " · own")}</span>
                </td>
                <td className="mono r">{fmtTime(p.pickup!.requestedAt)}</td>
                <td className="mono r">{fmtTime(p.pickup!.pickedUpAt!)}</td>
                <td className="mono r">{t("{n} min", { n: minutes(p.pickup!.pickedUpAt! - p.pickup!.requestedAt) })}</td>
                <td className="mono r">{fmtTime(p.pickup!.arrivedAt!)}</td>
              </tr>
            ))}
            {!done.length && <EmptyRow cols={7} text={t("Completed pickups are listed here with every time.")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyDrawer({ p, onClose, onAssign }: { p: Pilgrim | null; onClose: () => void; onAssign: (p: Pilgrim) => void }) {
  const { now, hospital, driver } = useStore();
  const { t, p: pn, dur } = useT();
  if (!p) return null;
  const h = hospital(p.hospitalId);
  const d = driver(p.pickup?.driverId);
  return (
    <Drawer open={!!p} onClose={onClose} title={pn(p.name)} sub={<StatusText p={p} now={now} />}>
      {p.status === "ready" && (
        <div className="d-sec">
          <div className="row-actions">
            <button className="btn primary" onClick={() => onAssign(p)}>
              {t("Send our vehicle")}
            </button>
            <RideButton p={p} />
          </div>
          <p className="dim small">{t("Waiting in the ward for {dur}.", { dur: dur(minutes(now - p.pickup!.requestedAt)) })}</p>
        </div>
      )}
      {p.status === "in_treatment" && (
        <div className="d-sec">
          <p className="note">
            {t("In treatment since {time}.", { time: fmtTime(p.admittedAt) })}{" "}
            {p.expectedReadyAt
              ? t("Expected ready around {time}. You will get a pickup request when the hospital confirms.", { time: fmtTime(p.expectedReadyAt) })
              : t(p.observation ? "Under observation. The hospital will send a ready time when the doctor sets one." : "The hospital has not given an expected ready time yet.")}
          </p>
        </div>
      )}
      {p.status !== "in_treatment" && (
        <div className="d-sec">
          <Steps p={p} />
          {WAITING.includes(p.status) && p.status !== "ready" && (
            <p className="dim small">{t("Waiting in the ward for {dur}.", { dur: dur(minutes(now - p.pickup!.requestedAt)) })}</p>
          )}
        </div>
      )}
      <div className="d-sec row-actions">
        <FamilyButton p={p} />
        <span className="dim small">{t(p.family ? "The family gets status updates by SMS." : "No family contact on file.")}</span>
      </div>
      <div className="d-sec">
        <dl className="dl">
          <dt>{t("ID")}</dt>
          <dd className="mono">{p.idNumber}</dd>
          <dt>{t("Hospital")}</dt>
          <dd>{t("{hospital}, {area}", { hospital: h.name, area: h.area })}</dd>
          <dt>{t("Ward phone")}</dt>
          <dd className="mono" dir="ltr">{h.wardPhone}</dd>
          <dt>{t("Accommodation")}</dt>
          <dd>{pn(p.accommodation)}</dd>
          {p.checklist && (
            <>
              <dt>{t("Mobility")}</dt>
              <dd>{t(p.checklist.mobility === "wheelchair" ? "Wheelchair" : "Walking")}</dd>
            </>
          )}
          {d && (
            <>
              <dt>{t("Driver")}</dt>
              <dd>{t("{driver}, {vehicle} {plate}", { driver: d.name, vehicle: d.vehicle, plate: d.plate })}</dd>
            </>
          )}
          {p.status === "accepted" && p.pickup?.eta && (
            <>
              <dt>{t("Due at hospital")}</dt>
              <dd className={isLate(p, now) ? "t-red" : ""}>
                {isLate(p, now) ? t("{time}, {n} min late", { time: fmtTime(p.pickup.eta), n: minutes(now - p.pickup.eta) }) : fmtTime(p.pickup.eta)}
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="d-sec">
        <PrivacyNote />
      </div>
      <div className="d-sec">
        <div className="label">{t("Timeline")}</div>
        <Timeline p={p} />
      </div>
    </Drawer>
  );
}
