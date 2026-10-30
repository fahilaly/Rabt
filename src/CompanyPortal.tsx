import React, { useState } from "react";
import { LuAccessibility } from "react-icons/lu";
import type { Pilgrim } from "./types";
import { WAITING, fmtDuration, fmtTime, isLate, minutes, useStore } from "./store";
import { Drawer, EmptyRow, Modal, PageHeader, PrivacyNote, Section, StatusText, Steps, Timeline } from "./ui";

type Tab = "requests" | "pilgrims" | "history";

export default function CompanyPortal({ companyId, tab, openId, setOpenId }: {
  companyId: string; tab: Tab; openId: string | null; setOpenId: (id: string | null) => void;
}) {
  const { state, now } = useStore();
  const [assignFor, setAssignFor] = useState<Pilgrim | null>(null);
  const mine = state.pilgrims.filter((p) => p.companyId === companyId);
  const late = mine.filter((p) => isLate(p, now));
  const open = mine.find((p) => p.id === openId) ?? null;

  return (
    <>
      {late.length > 0 && (
        <div className="alert-bar" role="alert">
          <span>
            <b>{late.length === 1 ? `Vehicle late for ${late[0].name}.` : `${late.length} vehicles are late.`}</b> The hospital can see the delay on its ward board.
          </span>
          <button className="link" onClick={() => setOpenId(late[0].id)}>
            Open
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
  const c = company(companyId);
  const needs = list.filter((p) => p.status === "ready").sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const moving = list.filter((p) => ["ride_requested", "assigned", "accepted", "picked_up"].includes(p.status)).sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const inTreatment = list.filter((p) => p.status === "in_treatment").length;
  const soon = list.filter((p) => p.status === "in_treatment").sort((a, b) => (a.expectedReadyAt ?? Infinity) - (b.expectedReadyAt ?? Infinity));

  return (
    <div className="page">
      <PageHeader
        title="Pickup requests"
        meta={
          <>
            {c.name} · {c.plan === "full" ? "Full plan, Rabt rides available" : "Basic plan, own vehicles"} · {inTreatment} still in treatment
          </>
        }
      />

      <Section title="Need a vehicle" count={needs.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pilgrim</th>
                <th>Hospital</th>
                <th className="r">Ready</th>
                <th className="r">Waiting</th>
                <th>Needs</th>
                <th className="actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {needs.map((p) => {
                const h = hospital(p.hospitalId);
                const wait = minutes(now - p.pickup!.requestedAt);
                return (
                  <tr key={p.id}>
                    <td>
                      <button className="link name" onClick={() => onOpen(p.id)}>
                        {p.name}
                      </button>
                      <div className="dim small">To {p.accommodation}</div>
                    </td>
                    <td>
                      {h.name}
                      <div className="dim small mono">Ward {h.wardPhone}</div>
                    </td>
                    <td className="mono r">{fmtTime(p.pickup!.requestedAt)}</td>
                    <td className={`mono r ${wait >= 15 ? "t-amber strong" : ""}`}>{wait} min</td>
                    <td>{p.checklist?.mobility === "wheelchair" ? <span className="t-blue"><LuAccessibility aria-hidden="true" /> Wheelchair</span> : <span className="dim">Walking</span>}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button className="btn primary sm" onClick={() => onAssign(p)}>
                          Send our vehicle
                        </button>
                        <RideButton p={p} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!needs.length && <EmptyRow cols={6} text="No pickups waiting. New requests appear here when a hospital confirms a pilgrim is ready." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="In progress" count={moving.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pilgrim</th>
                <th>Hospital</th>
                <th>Driver</th>
                <th className="r">Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {moving.map((p) => {
                const d = driver(p.pickup?.driverId);
                return (
                  <tr key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                    <td className="name">{p.name}</td>
                    <td>{hospital(p.hospitalId).name}</td>
                    <td>
                      {d ? d.name : <span className="dim">Fleet partner assigning</span>}
                      {d && <span className="dim">{p.pickup?.mode === "rabt" ? " · Rabt ride" : " · own"}</span>}
                    </td>
                    <td className="mono r">{p.status === "accepted" && p.pickup?.eta ? fmtTime(p.pickup.eta) : "–"}</td>
                    <td>
                      <StatusText p={p} now={now} />
                    </td>
                  </tr>
                );
              })}
              {!moving.length && <EmptyRow cols={5} text="Nothing in progress." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Still in treatment" count={soon.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pilgrim</th>
                <th>Hospital</th>
                <th className="r">Admitted</th>
                <th className="r">Expected ready</th>
              </tr>
            </thead>
            <tbody>
              {soon.map((p) => (
                <tr key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                  <td className="name">{p.name}</td>
                  <td>{hospital(p.hospitalId).name}</td>
                  <td className="mono r">{fmtTime(p.admittedAt)}</td>
                  <td className="r">{expectedCell(p, now)}</td>
                </tr>
              ))}
              {!soon.length && <EmptyRow cols={4} text="None of your pilgrims are in treatment." />}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function expectedCell(p: Pilgrim, now: number) {
  if (!p.expectedReadyAt) return <span className="dim">Waiting for the doctor</span>;
  const diff = minutes(p.expectedReadyAt - now);
  return (
    <>
      <span className="mono">~{fmtTime(p.expectedReadyAt)}</span>
      <span className="dim small">{p.expectedReadyAt > now ? ` · in ${fmtDuration(diff)}` : " · any time now"}</span>
    </>
  );
}

function RideButton({ p }: { p: Pilgrim }) {
  const { company, requestRide } = useStore();
  const full = company(p.companyId).plan === "full";
  if (!full) return <span className="dim small">Rabt ride: Full plan</span>;
  return (
    <button className="btn sm" onClick={() => requestRide(p.id)}>
      Request Rabt ride
    </button>
  );
}

function AssignModal({ p, companyId, onClose }: { p: Pilgrim | null; companyId: string; onClose: () => void }) {
  const { state, assignOwn, etaFor } = useStore();
  const [driverId, setDriverId] = useState<string>("");
  if (!p) return null;
  const drivers = state.drivers.filter((d) => d.companyId === companyId).sort((a, b) => etaFor(a.id, p.hospitalId).minutes - etaFor(b.id, p.hospitalId).minutes);
  const busy = (id: string) => state.pilgrims.some((x) => x.pickup?.driverId === id && ["assigned", "accepted", "picked_up"].includes(x.status));
  const needsChair = p.checklist?.mobility === "wheelchair";
  const chosen = drivers.find((d) => d.id === driverId);

  return (
    <Modal open={!!p} onClose={onClose} title={`Send a vehicle for ${p.name}`}>
      <fieldset className="radios">
        <legend className="label">Driver</legend>
        {drivers.map((d) => (
          <label key={d.id} className="radio driver-opt">
            <input id={`drv-${d.id}`} type="radio" name="driver" checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
            <span>
              {d.name}
              <span className="dim">
                {" "}
                · {d.vehicle} · <span className="mono">{d.plate}</span>
                {d.wheelchair ? " · accessible" : ""}
                {busy(d.id) ? " · on another trip" : ""}
              </span>
              <span className="dim small opt-where">Now at {d.at}</span>
            </span>
            <span className="opt-eta">
              <span className="mono">{etaFor(d.id, p.hospitalId).minutes} min</span>
              <span className="dim small">{etaFor(d.id, p.hospitalId).km} km</span>
            </span>
          </label>
        ))}
        {!drivers.length && <p className="dim">No drivers set up for this company.</p>}
      </fieldset>
      {needsChair && chosen && !chosen.wheelchair && <p className="note amber">This pilgrim uses a wheelchair and this vehicle isn't marked accessible.</p>}
      <p className="dim small">Times are Rabt's estimate to reach the hospital. The driver confirms an arrival time on their phone, and the hospital sees it on the ward board.</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!driverId}
          onClick={() => {
            assignOwn(p.id, driverId);
            setDriverId("");
            onClose();
          }}
        >
          Assign driver
        </button>
      </div>
    </Modal>
  );
}

function InHospital({ list, onOpen }: { list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { now, hospital } = useStore();
  const rows = list.filter((p) => p.status !== "arrived").sort((a, b) => order(a) - order(b));
  return (
    <div className="page">
      <PageHeader title="Pilgrims in hospital" meta="Where each of your pilgrims is. Clinical details stay with the hospital." />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pilgrim</th>
              <th>ID</th>
              <th>Hospital</th>
              <th>Status</th>
              <th className="r">Expected ready</th>
              <th className="r">Since</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td>
                  <span className="name">{p.name}</span>
                  <span className="dim"> · {p.nationality}</span>
                </td>
                <td className="mono dim">{p.idNumber}</td>
                <td>{hospital(p.hospitalId).name}</td>
                <td>
                  <StatusText p={p} now={now} />
                </td>
                <td className="r">{p.status === "in_treatment" ? expectedCell(p, now) : <span className="dim">Ready</span>}</td>
                <td className="mono r">{p.status === "in_treatment" ? fmtTime(p.admittedAt) : fmtTime(p.pickup!.requestedAt)}</td>
              </tr>
            ))}
            {!rows.length && <EmptyRow cols={6} text="None of your pilgrims are in hospital." />}
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
  const done = list.filter((p) => p.status === "arrived").sort((a, b) => b.pickup!.arrivedAt! - a.pickup!.arrivedAt!);
  const waits = done.map((p) => minutes(p.pickup!.pickedUpAt! - p.pickup!.requestedAt)).sort((a, b) => a - b);
  const mid = Math.floor(waits.length / 2);
  const median = !waits.length ? 0 : waits.length % 2 ? waits[mid] : Math.round((waits[mid - 1] + waits[mid]) / 2);

  return (
    <div className="page">
      <PageHeader title="Completed" meta={done.length ? <>{done.length} pickups · median wait in the ward {fmtDuration(median)}</> : "No completed pickups yet"} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pilgrim</th>
              <th>Hospital</th>
              <th>Driver</th>
              <th className="r">Ready</th>
              <th className="r">Picked up</th>
              <th className="r">Wait</th>
              <th className="r">Arrived</th>
            </tr>
          </thead>
          <tbody>
            {done.map((p) => (
              <tr key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td className="name">{p.name}</td>
                <td>{hospital(p.hospitalId).name}</td>
                <td>
                  {driver(p.pickup!.driverId)?.name}
                  <span className="dim">{p.pickup!.mode === "rabt" ? " · Rabt ride" : " · own"}</span>
                </td>
                <td className="mono r">{fmtTime(p.pickup!.requestedAt)}</td>
                <td className="mono r">{fmtTime(p.pickup!.pickedUpAt!)}</td>
                <td className="mono r">{minutes(p.pickup!.pickedUpAt! - p.pickup!.requestedAt)} min</td>
                <td className="mono r">{fmtTime(p.pickup!.arrivedAt!)}</td>
              </tr>
            ))}
            {!done.length && <EmptyRow cols={7} text="Completed pickups are listed here with every time." />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyDrawer({ p, onClose, onAssign }: { p: Pilgrim | null; onClose: () => void; onAssign: (p: Pilgrim) => void }) {
  const { now, hospital, driver } = useStore();
  if (!p) return null;
  const h = hospital(p.hospitalId);
  const d = driver(p.pickup?.driverId);
  return (
    <Drawer open={!!p} onClose={onClose} title={p.name} sub={<StatusText p={p} now={now} />}>
      {p.status === "ready" && (
        <div className="d-sec">
          <div className="row-actions">
            <button className="btn primary" onClick={() => onAssign(p)}>
              Send our vehicle
            </button>
            <RideButton p={p} />
          </div>
          <p className="dim small">Waiting in the ward for {fmtDuration(minutes(now - p.pickup!.requestedAt))}.</p>
        </div>
      )}
      {p.status === "in_treatment" && (
        <div className="d-sec">
          <p className="note">
            In treatment since <span className="mono">{fmtTime(p.admittedAt)}</span>.{" "}
            {p.expectedReadyAt ? (
              <>
                Expected ready around <span className="mono">{fmtTime(p.expectedReadyAt)}</span>. You will get a pickup request when the hospital confirms.
              </>
            ) : (
              "The hospital has not given an expected ready time yet."
            )}
          </p>
        </div>
      )}
      {p.status !== "in_treatment" && (
        <div className="d-sec">
          <Steps p={p} />
          {WAITING.includes(p.status) && p.status !== "ready" && (
            <p className="dim small">Waiting in the ward for {fmtDuration(minutes(now - p.pickup!.requestedAt))}.</p>
          )}
        </div>
      )}
      <div className="d-sec">
        <dl className="dl">
          <dt>ID</dt>
          <dd className="mono">{p.idNumber}</dd>
          <dt>Hospital</dt>
          <dd>
            {h.name}, {h.area}
          </dd>
          <dt>Ward phone</dt>
          <dd className="mono">{h.wardPhone}</dd>
          <dt>Accommodation</dt>
          <dd>{p.accommodation}</dd>
          {p.checklist && (
            <>
              <dt>Mobility</dt>
              <dd>{p.checklist.mobility === "wheelchair" ? "Wheelchair" : "Walking"}</dd>
            </>
          )}
          {d && (
            <>
              <dt>Driver</dt>
              <dd>
                {d.name}, {d.vehicle} <span className="mono">{d.plate}</span>
              </dd>
            </>
          )}
          {p.status === "accepted" && p.pickup?.eta && (
            <>
              <dt>Due at hospital</dt>
              <dd className={isLate(p, now) ? "t-red" : ""}>
                <span className="mono">{fmtTime(p.pickup.eta)}</span>
                {isLate(p, now) ? `, ${minutes(now - p.pickup.eta)} min late` : ""}
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="d-sec">
        <PrivacyNote />
      </div>
      <div className="d-sec">
        <div className="label">Timeline</div>
        <Timeline p={p} />
      </div>
    </Drawer>
  );
}
