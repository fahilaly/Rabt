import React, { useMemo, useState } from "react";
import { LuSearch, LuMaximize2, LuMinimize2, LuAccessibility } from "react-icons/lu";
import type { DirectoryEntry, Mobility, Pilgrim } from "./types";
import { WAITING, fmtDuration, fmtTime, isLate, minutes, useStore } from "./store";
import { Drawer, EmptyRow, Field, Modal, PageHeader, StatusText, Steps, Timeline } from "./ui";

type Tab = "ward" | "patients" | "register";

export default function HospitalPortal({ hospitalId, tab, setTab, openId, setOpenId }: {
  hospitalId: string; tab: Tab; setTab: (t: Tab) => void; openId: string | null; setOpenId: (id: string | null) => void;
}) {
  const { state } = useStore();
  const mine = state.pilgrims.filter((p) => p.hospitalId === hospitalId);
  const open = mine.find((p) => p.id === openId) ?? null;

  return (
    <>
      {tab === "ward" && <Board hospitalId={hospitalId} list={mine} onOpen={setOpenId} />}
      {tab === "patients" && <Patients list={mine} onOpen={setOpenId} />}
      {tab === "register" && <Register hospitalId={hospitalId} onDone={(id) => { setTab("patients"); setOpenId(id); }} />}
      <PatientDrawer p={open} onClose={() => setOpenId(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Recovery ward: a departures board. Each row is a pilgrim waiting for a ride.

function Board({ hospitalId, list, onOpen }: { hospitalId: string; list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { now, company, driver, hospital } = useStore();
  const [full, setFull] = useState(false);
  const h = hospital(hospitalId);
  const waiting = list.filter((p) => WAITING.includes(p.status)).sort((a, b) => (a.pickup?.requestedAt ?? 0) - (b.pickup?.requestedAt ?? 0));
  const left = list
    .filter((p) => (p.status === "picked_up" || p.status === "arrived") && p.pickup?.pickedUpAt && now - p.pickup.pickedUpAt < 3 * 60 * 60_000)
    .sort((a, b) => b.pickup!.pickedUpAt! - a.pickup!.pickedUpAt!)
    .slice(0, 4);
  const late = waiting.filter((p) => isLate(p, now)).length;
  const longest = waiting.length ? minutes(now - (waiting[0].pickup?.requestedAt ?? now)) : 0;

  return (
    <section className={`board ${full ? "board-full" : ""}`} aria-label="Recovery ward board">
      <header className="board-head">
        <div>
          <div className="board-title">
            <span>Recovery ward</span>
            <span className="board-ar" lang="ar" dir="rtl">
              قسم المتحسنين
            </span>
          </div>
          <div className="board-sub">
            {h.name} · {h.area}
          </div>
        </div>
        <div className="board-right">
          <div className="board-clock mono">{fmtTime(now)}</div>
          <button className="board-btn" onClick={() => setFull(!full)}>
            {full ? <LuMinimize2 aria-hidden="true" /> : <LuMaximize2 aria-hidden="true" />}
            {full ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </header>

      <div className="board-summary mono">
        <span>
          <b>{waiting.length}</b> waiting
        </span>
        <span className={late ? "b-red" : ""}>
          <b>{late}</b> late
        </span>
        <span>
          longest <b>{fmtDuration(longest)}</b>
        </span>
      </div>

      <div className="board-scroll">
        <table className="board-table">
          <thead>
            <tr>
              <th className="c-time">
                Ready <span lang="ar">الجاهزية</span>
              </th>
              <th>
                Pilgrim <span lang="ar">الحاج</span>
              </th>
              <th>
                Company <span lang="ar">الشركة</span>
              </th>
              <th>
                Vehicle <span lang="ar">المركبة</span>
              </th>
              <th className="c-time">
                Due <span lang="ar">الوصول</span>
              </th>
              <th>
                Status <span lang="ar">الحالة</span>
              </th>
              <th className="c-num">
                Wait <span lang="ar">الانتظار</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((p) => {
              const d = driver(p.pickup?.driverId);
              const l = isLate(p, now);
              const wait = minutes(now - (p.pickup?.requestedAt ?? now));
              const [label, tone] = boardStatus(p, l, now);
              return (
                <tr key={p.id} className={l ? "row-late" : ""} tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                  <td className="mono c-time">{fmtTime(p.pickup!.requestedAt)}</td>
                  <td className="b-name">
                    {p.name}
                    {p.checklist?.mobility === "wheelchair" && <LuAccessibility className="b-chair" aria-label="Wheelchair" />}
                  </td>
                  <td className="b-dim">{company(p.companyId).name}</td>
                  <td className="b-dim">
                    {d ? (
                      <>
                        {d.vehicle} <span className="mono">{d.plate}</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="mono c-time">
                    {p.pickup?.eta && p.status === "accepted" ? (
                      fmtTime(p.pickup.eta)
                    ) : p.status === "assigned" && p.pickup?.estimateMin && p.pickup.assignedAt ? (
                      <span className="b-est" title="Rabt estimate, not yet confirmed by the driver">~{fmtTime(p.pickup.assignedAt + p.pickup.estimateMin * 60000)}</span>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className={`b-status ${tone}`}>{label}</td>
                  <td className={`mono c-num b-wait ${wait >= 20 ? "b-amber" : ""} ${l ? "b-red" : ""}`}>{wait}</td>
                </tr>
              );
            })}
            {!waiting.length && (
              <tr>
                <td colSpan={7} className="b-empty">
                  No patients waiting for transport.
                </td>
              </tr>
            )}
            {left.map((p) => (
              <tr key={p.id} className="row-left" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td className="mono c-time">{fmtTime(p.pickup!.requestedAt)}</td>
                <td>{p.name}</td>
                <td>{company(p.companyId).name}</td>
                <td>{driver(p.pickup?.driverId)?.vehicle ?? "–"}</td>
                <td className="mono c-time">{fmtTime(p.pickup!.pickedUpAt!)}</td>
                <td>Left the ward</td>
                <td className="mono c-num">{minutes(p.pickup!.pickedUpAt! - p.pickup!.requestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="board-foot">Wait = minutes since the patient was confirmed ready. ~ = Rabt estimate until the driver confirms. Rows turn red when a vehicle passes its arrival time.</footer>
    </section>
  );
}

function boardStatus(p: Pilgrim, late: boolean, now: number): [string, string] {
  if (late) return [`Late ${minutes(now - p.pickup!.eta!)} min`, "b-red"];
  switch (p.status) {
    case "ready":
      return ["Waiting for company", "b-amber"];
    case "ride_requested":
      return ["Finding a driver", "b-amber"];
    case "assigned":
      return ["Driver assigned", "b-white"];
    case "accepted":
      return ["On the way", "b-green"];
    default:
      return ["", ""];
  }
}

// ---------------------------------------------------------------------------

function Patients({ list, onOpen }: { list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { company, now } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"active" | "treatment" | "waiting" | "left">("active");

  const rows = useMemo(() => {
    let r = list;
    if (filter === "active") r = r.filter((p) => p.status !== "arrived" && p.status !== "picked_up");
    if (filter === "treatment") r = r.filter((p) => p.status === "in_treatment");
    if (filter === "waiting") r = r.filter((p) => WAITING.includes(p.status));
    if (filter === "left") r = r.filter((p) => p.status === "picked_up" || p.status === "arrived");
    const n = q.trim().toLowerCase();
    if (n) r = r.filter((p) => p.name.toLowerCase().includes(n) || p.idNumber.toLowerCase().includes(n) || company(p.companyId).name.toLowerCase().includes(n));
    return [...r].sort((a, b) => b.admittedAt - a.admittedAt);
  }, [list, filter, q, company]);

  const treatment = list.filter((p) => p.status === "in_treatment").length;
  const waiting = list.filter((p) => WAITING.includes(p.status)).length;
  const late = list.filter((p) => isLate(p, now)).length;

  return (
    <div className="page">
      <PageHeader
        title="Patients"
        meta={
          <>
            {treatment} in treatment · {waiting} waiting for transport
            {late > 0 && <span className="t-red"> · {late} vehicle late</span>}
          </>
        }
      />
      <div className="filters">
        <div className="tabs" role="tablist" aria-label="Filter">
          {([["active", "Active"], ["treatment", "In treatment"], ["waiting", "Waiting"], ["left", "Left"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="search">
          <LuSearch aria-hidden="true" />
          <input id="patient-search" placeholder="Name, ID or company" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pilgrim</th>
              <th>ID</th>
              <th>Company</th>
              <th>Status</th>
              <th className="r">Since</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="clickable" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                <td>
                  <span className="name">{p.name}</span>
                  <span className="dim"> · {p.nationality}, {p.age}</span>
                </td>
                <td className="mono dim">{p.idNumber}</td>
                <td>{company(p.companyId).name}</td>
                <td>
                  <StatusText p={p} now={now} />
                </td>
                <td className="mono r">{sinceCell(p, now)}</td>
              </tr>
            ))}
            {!rows.length && <EmptyRow cols={5} text="No patients match this filter." />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sinceCell(p: Pilgrim, now: number) {
  if (p.status === "in_treatment") return `${fmtTime(p.admittedAt)} (${fmtDuration(minutes(now - p.admittedAt))})`;
  if (WAITING.includes(p.status)) return `${fmtTime(p.pickup!.requestedAt)} (${minutes(now - p.pickup!.requestedAt)} min)`;
  if (p.pickup?.pickedUpAt) return `left ${fmtTime(p.pickup.pickedUpAt)}`;
  return "";
}

// ---------------------------------------------------------------------------

function PatientDrawer({ p, onClose }: { p: Pilgrim | null; onClose: () => void }) {
  const { company, driver, now, hospital } = useStore();
  const [readyOpen, setReadyOpen] = useState(false);
  if (!p) return null;
  const c = company(p.companyId);
  const d = driver(p.pickup?.driverId);
  const late = isLate(p, now);

  return (
    <Drawer open={!!p} onClose={onClose} title={p.name} sub={<StatusText p={p} now={now} />}>
      {p.status === "in_treatment" && (
        <div className="d-sec">
          <button className="btn primary" onClick={() => setReadyOpen(true)}>
            Ready for transport
          </button>
          <p className="dim small">Sends a pickup request to {c.name}.</p>
        </div>
      )}
      {p.status !== "in_treatment" && (
        <div className="d-sec">
          <Steps p={p} />
          {p.status === "ready" && <p className="note amber">Waiting for {c.name} to send a vehicle.</p>}
          {p.status === "ride_requested" && <p className="note amber">{c.name} requested a Rabt ride. The fleet partner is assigning a driver.</p>}
          {p.status === "assigned" && d && <p className="note">{d.name} assigned ({d.vehicle}, <span className="mono">{d.plate}</span>). Not accepted yet.</p>}
          {p.status === "accepted" && d && (
            <p className={`note ${late ? "red" : ""}`}>
              {d.name} due <span className="mono">{fmtTime(p.pickup!.eta!)}</span>
              {late ? `, ${minutes(now - p.pickup!.eta!)} min late` : ""} · {d.vehicle} <span className="mono">{d.plate}</span>
            </p>
          )}
        </div>
      )}
      <div className="d-sec">
        <dl className="dl">
          <dt>{p.idType === "nusuk" ? "Nusuk card" : "Booking"}</dt>
          <dd className="mono">{p.idNumber}</dd>
          <dt>Company</dt>
          <dd>
            {c.name} ({c.type === "umrah" ? "Umrah" : "Hajj"})
          </dd>
          <dt>Nationality</dt>
          <dd>
            {p.nationality}, {p.age}
          </dd>
          <dt>Accommodation</dt>
          <dd>{p.accommodation}</dd>
          <dt>Admitted</dt>
          <dd>
            <span className="mono">{fmtTime(p.admittedAt)}</span>, {hospital(p.hospitalId).name}
          </dd>
          {p.checklist && (
            <>
              <dt>Mobility</dt>
              <dd>{p.checklist.mobility === "wheelchair" ? "Wheelchair" : "Walking"}</dd>
            </>
          )}
          <dt>Clinical note</dt>
          <dd>
            {p.clinicalNote} <span className="dim">(hospital only)</span>
          </dd>
        </dl>
      </div>
      <div className="d-sec">
        <div className="label">Timeline</div>
        <Timeline p={p} />
      </div>
      <ReadyModal p={p} open={readyOpen} onClose={() => setReadyOpen(false)} />
    </Drawer>
  );
}

function ReadyModal({ p, open, onClose }: { p: Pilgrim; open: boolean; onClose: () => void }) {
  const { markReady, company } = useStore();
  const [medicines, setMedicines] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [mobility, setMobility] = useState<Mobility>("walking");
  const ok = medicines && instructions && cleared;

  return (
    <Modal open={open} onClose={onClose} title="Ready for transport">
      <div className="checks">
        <label className="check">
          <input id="chk-med" type="checkbox" checked={medicines} onChange={(e) => setMedicines(e.target.checked)} />
          <span>Discharge medicines dispensed</span>
        </label>
        <label className="check">
          <input id="chk-inst" type="checkbox" checked={instructions} onChange={(e) => setInstructions(e.target.checked)} />
          <span>Discharge instructions given in the patient's language</span>
        </label>
        <label className="check">
          <input id="chk-clear" type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
          <span>Cleared for ordinary transport, no medical escort</span>
        </label>
      </div>
      <fieldset className="radios">
        <legend className="label">Mobility</legend>
        {(["walking", "wheelchair"] as Mobility[]).map((m) => (
          <label key={m} className="radio">
            <input id={`mob-${m}`} type="radio" name="mobility" checked={mobility === m} onChange={() => setMobility(m)} />
            <span>{m === "walking" ? "Walking" : "Wheelchair, accessible vehicle needed"}</span>
          </label>
        ))}
      </fieldset>
      <p className="dim small">Patients needing an ambulance or medical escort go through the hospital's clinical transfer, not Rabt.</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => {
            markReady(p.id, { medicines, instructions, cleared, mobility });
            onClose();
          }}
        >
          Send request to {company(p.companyId).name}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Register({ hospitalId, onDone }: { hospitalId: string; onDone: (id: string) => void }) {
  const { lookup, register, company, state } = useStore();
  const [idType, setIdType] = useState<DirectoryEntry["idType"]>("nusuk");
  const [idNumber, setIdNumber] = useState("");
  const [result, setResult] = useState<DirectoryEntry | Pilgrim | null | "none">(null);
  const samples = state.directory.filter((d) => d.idType === idType && !state.pilgrims.some((p) => p.idNumber === d.idNumber && p.status !== "arrived"));
  const doLookup = (n = idNumber) => setResult(lookup(idType, n) ?? "none");

  return (
    <div className="page narrow">
      <PageHeader title="Register pilgrim" meta="Links this visit to the company responsible for the pilgrim." />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          doLookup();
        }}
      >
        <fieldset className="radios inline">
          <legend className="label">Identify by</legend>
          <label className="radio">
            <input id="idt-nusuk" type="radio" name="idtype" checked={idType === "nusuk"} onChange={() => { setIdType("nusuk"); setResult(null); setIdNumber(""); }} />
            <span>Nusuk card (Hajj)</span>
          </label>
          <label className="radio">
            <input id="idt-booking" type="radio" name="idtype" checked={idType === "booking"} onChange={() => { setIdType("booking"); setResult(null); setIdNumber(""); }} />
            <span>Company booking (Umrah)</span>
          </label>
        </fieldset>
        <div className="form-row">
          <Field label={idType === "nusuk" ? "Card number" : "Booking reference"} htmlFor="lookup-id">
            <input id="lookup-id" className="input mono" placeholder={idType === "nusuk" ? "NSK-0000000" : "UMR-00000"} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </Field>
          <button className="btn primary" type="submit" disabled={!idNumber.trim()}>
            Look up
          </button>
        </div>
        {samples.length > 0 && (
          <div className="small dim">
            Sample numbers:{" "}
            {samples.map((s, i) => (
              <React.Fragment key={s.idNumber}>
                {i > 0 && ", "}
                <button type="button" className="link mono" onClick={() => { setIdNumber(s.idNumber); doLookup(s.idNumber); }}>
                  {s.idNumber}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </form>

      {result === "none" && <p className="note red">No pilgrim found with that number.</p>}
      {result && result !== "none" && "status" in result && <p className="note">{result.name} is already registered.</p>}
      {result && result !== "none" && !("status" in result) && (
        <div className="result">
          <div className="result-name">{result.name}</div>
          <dl className="dl">
            <dt>Nationality</dt>
            <dd>
              {result.nationality}, {result.age}
            </dd>
            <dt>Company</dt>
            <dd>
              {company(result.companyId).name} ({company(result.companyId).type === "umrah" ? "Umrah" : "Hajj"})
            </dd>
            <dt>Company manager</dt>
            <dd>{company(result.companyId).manager}</dd>
            <dt>Accommodation</dt>
            <dd>{result.accommodation}</dd>
          </dl>
          <div className="modal-actions start">
            <button className="btn primary" onClick={() => onDone(register(hospitalId, result))}>
              Register at emergency
            </button>
          </div>
          <p className="dim small">The company is told their pilgrim is at this hospital. No diagnosis is shared.</p>
        </div>
      )}
      <p className="dim small">Prototype lookup with sample records. A live version needs authorised access to Nusuk and company booking data.</p>
    </div>
  );
}
