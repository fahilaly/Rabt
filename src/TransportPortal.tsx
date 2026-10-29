import React, { useState } from "react";
import { LuAccessibility, LuPhone } from "react-icons/lu";
import type { Pilgrim } from "./types";
import { fmtTime, isLate, minutes, useStore } from "./store";
import { EmptyRow, PageHeader, Section, StatusText } from "./ui";

type Tab = "driver" | "dispatch";

export default function TransportPortal({ tab, driverId }: { tab: Tab; driverId: string }) {
  return tab === "driver" ? <DriverApp driverId={driverId} /> : <Dispatch />;
}

// ---------------------------------------------------------------------------
// Driver app. Built for a phone; on a laptop it sits in a phone-sized frame
// next to the driver's trip log.

function DriverApp({ driverId }: { driverId: string }) {
  const { state, driver, company, hospital, now } = useStore();
  const d = driver(driverId)!;
  const trips = state.pilgrims.filter((p) => p.pickup?.driverId === driverId);
  const active = trips.filter((p) => ["assigned", "accepted", "picked_up"].includes(p.status)).sort((a, b) => a.pickup!.assignedAt! - b.pickup!.assignedAt!);
  const log = [...trips].sort((a, b) => (b.pickup?.assignedAt ?? 0) - (a.pickup?.assignedAt ?? 0));

  return (
    <div className="page">
      <PageHeader title="Driver app" meta={<>{d.name} · {d.vehicle} <span className="mono">{d.plate}</span> · {d.companyId ? company(d.companyId).name : "Fleet partner"}</>} />
      <div className="driver-layout">
        <div className="phone" aria-label="Driver phone screen">
          <div className="phone-status mono">
            <span>{fmtTime(now)}</span>
            <span>Rabt Driver</span>
          </div>
          <div className="phone-body">
            {active.length ? active.map((p) => <Trip key={p.id} p={p} now={now} />) : <p className="phone-empty">No trips right now. New pickups appear here when they are assigned to you.</p>}
          </div>
        </div>

        <Section title="Trip log" count={log.length}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pilgrim</th>
                  <th>From</th>
                  <th className="r">Accepted</th>
                  <th className="r">Picked up</th>
                  <th className="r">Arrived</th>
                </tr>
              </thead>
              <tbody>
                {log.map((p) => (
                  <tr key={p.id}>
                    <td className="name">{p.name}</td>
                    <td>{hospital(p.hospitalId).name}</td>
                    <td className="mono r">{p.pickup?.acceptedAt ? fmtTime(p.pickup.acceptedAt) : "–"}</td>
                    <td className="mono r">{p.pickup?.pickedUpAt ? fmtTime(p.pickup.pickedUpAt) : "–"}</td>
                    <td className="mono r">{p.pickup?.arrivedAt ? fmtTime(p.pickup.arrivedAt) : "–"}</td>
                  </tr>
                ))}
                {!log.length && <EmptyRow cols={5} text="No trips yet." />}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Trip({ p, now }: { p: Pilgrim; now: number }) {
  const { hospital, accept, pickedUp, arrived, company } = useStore();
  const [eta, setEta] = useState(15);
  const h = hospital(p.hospitalId);
  const late = isLate(p, now);
  const step = p.status === "assigned" ? "New pickup" : p.status === "accepted" ? "Go to hospital" : "Take to accommodation";
  return (
    <article className={`trip ${late ? "trip-late" : ""}`}>
      <div className="trip-step">{step}</div>
      <div className="trip-name">{p.name}</div>
      <div className="trip-co">{company(p.companyId).name}</div>
      <dl className="trip-legs">
        <dt>From</dt>
        <dd>
          {h.name}, recovery ward
          <span className="mono trip-phone">
            <LuPhone aria-hidden="true" /> {h.wardPhone}
          </span>
        </dd>
        <dt>To</dt>
        <dd>{p.accommodation}</dd>
      </dl>
      {p.checklist?.mobility === "wheelchair" && (
        <div className="trip-flag">
          <LuAccessibility aria-hidden="true" /> Wheelchair user
        </div>
      )}
      {p.status === "assigned" && (
        <>
          <div className="trip-q">I can be at the hospital in</div>
          <div className="eta" role="radiogroup" aria-label="Arrival time">
            {[10, 15, 20, 30].map((m) => (
              <button key={m} type="button" role="radio" aria-checked={eta === m} className={eta === m ? "on" : ""} onClick={() => setEta(m)}>
                {m} min
              </button>
            ))}
          </div>
          <button className="trip-btn" onClick={() => accept(p.id, eta)}>
            Accept pickup
          </button>
        </>
      )}
      {p.status === "accepted" && (
        <>
          <p className={`trip-due ${late ? "late" : ""}`}>
            {late ? `${minutes(now - p.pickup!.eta!)} min late. The company has been alerted.` : <>Due at the hospital <span className="mono">{fmtTime(p.pickup!.eta!)}</span></>}
          </p>
          <button className="trip-btn" onClick={() => pickedUp(p.id)}>
            Pilgrim picked up
          </button>
        </>
      )}
      {p.status === "picked_up" && (
        <button className="trip-btn" onClick={() => arrived(p.id)}>
          Arrived at accommodation
        </button>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Fleet dispatch: the licensed transport partner assigns drivers to Rabt rides.

function Dispatch() {
  const { state, now, hospital, company, driver, dispatchAssign } = useStore();
  const [pick, setPick] = useState<Record<string, string>>({});
  const partner = state.drivers.filter((d) => d.companyId === null);
  const open = state.pilgrims.filter((p) => p.status === "ride_requested").sort((a, b) => a.pickup!.requestedAt - b.pickup!.requestedAt);
  const live = state.pilgrims.filter((p) => p.pickup?.mode === "rabt" && ["assigned", "accepted", "picked_up"].includes(p.status));
  const busy = (id: string) => live.some((p) => p.pickup?.driverId === id);
  const free = partner.filter((d) => !busy(d.id)).length;

  return (
    <div className="page">
      <PageHeader title="Fleet dispatch" meta={<>Licensed transport partner · {open.length} open · {live.length} in progress · {free} of {partner.length} drivers free</>} />
      <Section title="Open ride requests" count={open.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pilgrim</th>
                <th>Company</th>
                <th>Pickup</th>
                <th className="r">Waiting</th>
                <th>Needs</th>
                <th className="actions-col">Driver</th>
              </tr>
            </thead>
            <tbody>
              {open.map((p) => {
                const needsChair = p.checklist?.mobility === "wheelchair";
                const sel = pick[p.id] ?? "";
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="name">{p.name}</span>
                      <div className="dim small">To {p.accommodation}</div>
                    </td>
                    <td>{company(p.companyId).name}</td>
                    <td>{hospital(p.hospitalId).name}</td>
                    <td className="mono r">{minutes(now - p.pickup!.requestedAt)} min</td>
                    <td>{needsChair ? <span className="t-blue"><LuAccessibility aria-hidden="true" /> Wheelchair</span> : <span className="dim">Walking</span>}</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <label className="sr-only" htmlFor={`dispatch-${p.id}`}>
                          Driver for {p.name}
                        </label>
                        <select id={`dispatch-${p.id}`} className="select sm" value={sel} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                          <option value="">Choose driver</option>
                          {partner.map((d) => (
                            <option key={d.id} value={d.id} disabled={needsChair && !d.wheelchair}>
                              {d.name}
                              {d.wheelchair ? " (accessible)" : ""}
                              {busy(d.id) ? ", on a trip" : ""}
                            </option>
                          ))}
                        </select>
                        <button className="btn primary sm" disabled={!sel} onClick={() => dispatchAssign(p.id, sel)}>
                          Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!open.length && <EmptyRow cols={6} text="No open requests. Companies on the Full plan request rides from their pickup screen." />}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="In progress" count={live.length}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pilgrim</th>
                <th>Driver</th>
                <th>From</th>
                <th className="r">Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {live.map((p) => (
                <tr key={p.id}>
                  <td className="name">{p.name}</td>
                  <td>{driver(p.pickup?.driverId)?.name}</td>
                  <td>{hospital(p.hospitalId).name}</td>
                  <td className="mono r">{p.status === "accepted" && p.pickup?.eta ? fmtTime(p.pickup.eta) : "–"}</td>
                  <td>
                    <StatusText p={p} now={now} />
                  </td>
                </tr>
              ))}
              {!live.length && <EmptyRow cols={5} text="No rides in progress." />}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
