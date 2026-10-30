import React, { useMemo, useState } from "react";
import { LuSearch, LuMaximize2, LuMinimize2, LuAccessibility } from "react-icons/lu";
import type { DirectoryEntry, Mobility, Pilgrim } from "./types";
import { WAITING, fmtTime, isLate, minutes, useStore } from "./store";
import { Drawer, EmptyRow, Field, Modal, PageHeader, StatusText, Steps, Timeline } from "./ui";
import { CONDITIONS, STAY_CHOICES, conditionLabel, suggestedStay } from "./stay";
import { useT, type T } from "./i18n";

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
  const { t, p, lang, dur } = useT();
  const [full, setFull] = useState(false);
  const other = lang === "ar" ? "en" : "ar";
  const bi = (en: string, ar: string) => (
    <>
      {lang === "ar" ? ar : en} <span lang={other}>{lang === "ar" ? en : ar}</span>
    </>
  );
  const h = hospital(hospitalId);
  const waiting = list.filter((p) => WAITING.includes(p.status)).sort((a, b) => (a.pickup?.requestedAt ?? 0) - (b.pickup?.requestedAt ?? 0));
  const left = list
    .filter((p) => (p.status === "picked_up" || p.status === "arrived") && p.pickup?.pickedUpAt && now - p.pickup.pickedUpAt < 3 * 60 * 60_000)
    .sort((a, b) => b.pickup!.pickedUpAt! - a.pickup!.pickedUpAt!)
    .slice(0, 4);
  const late = waiting.filter((p) => isLate(p, now)).length;
  const longest = waiting.length ? minutes(now - (waiting[0].pickup?.requestedAt ?? now)) : 0;

  return (
    <section className={`board ${full ? "board-full" : ""}`} aria-label={t("Recovery ward board")}>
      <header className="board-head">
        <div>
          <div className="board-title">
            <span>{lang === "ar" ? "قسم المتحسنين" : "Recovery ward"}</span>
            <span className="board-ar" lang={other}>
              {lang === "ar" ? "Recovery ward" : "قسم المتحسنين"}
            </span>
          </div>
          <div className="board-sub">
            {p(h.name)} · {p(h.area)}
          </div>
        </div>
        <div className="board-right">
          <div className="board-clock mono">{fmtTime(now)}</div>
          <button className="board-btn" onClick={() => setFull(!full)}>
            {full ? <LuMinimize2 aria-hidden="true" /> : <LuMaximize2 aria-hidden="true" />}
            {full ? t("Exit full screen") : t("Full screen")}
          </button>
        </div>
      </header>

      <div className="board-summary mono">
        <span>
          <b>{waiting.length}</b> {t("waiting")}
        </span>
        <span className={late ? "b-red" : ""}>
          <b>{late}</b> {t("late")}
        </span>
        <span>
          {t("longest")} <b>{dur(longest)}</b>
        </span>
      </div>

      <div className="board-scroll">
        <table className="board-table">
          <thead>
            <tr>
              <th className="c-time">
                {bi("Ready", "الجاهزية")}
              </th>
              <th>
                {bi("Pilgrim", "الحاج")}
              </th>
              <th>
                {bi("Company", "الشركة")}
              </th>
              <th>
                {bi("Vehicle", "المركبة")}
              </th>
              <th className="c-time">
                {bi("Due", "الوصول")}
              </th>
              <th>
                {bi("Status", "الحالة")}
              </th>
              <th className="c-num">
                {bi("Wait", "الانتظار")}
              </th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((x) => {
              const d = driver(x.pickup?.driverId);
              const l = isLate(x, now);
              const wait = minutes(now - (x.pickup?.requestedAt ?? now));
              const [label, tone] = boardStatus(x, l, now, t);
              return (
                <tr key={x.id} className={l ? "row-late" : ""} tabIndex={0} onClick={() => onOpen(x.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(x.id)}>
                  <td className="mono c-time">{fmtTime(x.pickup!.requestedAt)}</td>
                  <td className="b-name">
                    {p(x.name)}
                    {x.checklist?.mobility === "wheelchair" && <LuAccessibility className="b-chair" aria-label={t("Wheelchair")} />}
                  </td>
                  <td className="b-dim">{p(company(x.companyId).name)}</td>
                  <td className="b-dim">
                    {d ? (
                      <>
                        {p(d.vehicle)} <span className="mono">{d.plate}</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="mono c-time">
                    {x.pickup?.eta && x.status === "accepted" ? (
                      fmtTime(x.pickup.eta)
                    ) : x.status === "assigned" && x.pickup?.estimateMin && x.pickup.assignedAt ? (
                      <span className="b-est" title={t("Rabt estimate, not yet confirmed by the driver")}>~{fmtTime(x.pickup.assignedAt + x.pickup.estimateMin * 60000)}</span>
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
                  {t("No patients waiting for transport.")}
                </td>
              </tr>
            )}
            {left.map((x) => (
              <tr key={x.id} className="row-left" tabIndex={0} onClick={() => onOpen(x.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(x.id)}>
                <td className="mono c-time">{fmtTime(x.pickup!.requestedAt)}</td>
                <td>{p(x.name)}</td>
                <td>{p(company(x.companyId).name)}</td>
                <td>{p(driver(x.pickup?.driverId)?.vehicle ?? "–")}</td>
                <td className="mono c-time">{fmtTime(x.pickup!.pickedUpAt!)}</td>
                <td>{t("Left the ward")}</td>
                <td className="mono c-num">{minutes(x.pickup!.pickedUpAt! - x.pickup!.requestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="board-foot">{t("Wait = minutes since the patient was confirmed ready. ~ = Rabt estimate until the driver confirms. Rows turn red when a vehicle passes its arrival time.")}</footer>
    </section>
  );
}

function boardStatus(p: Pilgrim, late: boolean, now: number, t: T["t"]): [string, string] {
  if (late) return [t("Late {n} min", { n: minutes(now - p.pickup!.eta!) }), "b-red"];
  switch (p.status) {
    case "ready":
      return [t("Waiting for company"), "b-amber"];
    case "ride_requested":
      return [t("Finding a driver"), "b-amber"];
    case "assigned":
      return [t("Driver assigned"), "b-white"];
    case "accepted":
      return [t("On the way"), "b-green"];
    default:
      return ["", ""];
  }
}

// ---------------------------------------------------------------------------

function Patients({ list, onOpen }: { list: Pilgrim[]; onOpen: (id: string) => void }) {
  const { company, now } = useStore();
  const T = useT();
  const { t, p } = T;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"active" | "treatment" | "waiting" | "left">("active");

  const rows = useMemo(() => {
    let r = list;
    if (filter === "active") r = r.filter((p) => p.status !== "arrived" && p.status !== "picked_up");
    if (filter === "treatment") r = r.filter((p) => p.status === "in_treatment");
    if (filter === "waiting") r = r.filter((p) => WAITING.includes(p.status));
    if (filter === "left") r = r.filter((p) => p.status === "picked_up" || p.status === "arrived");
    const n = q.trim().toLowerCase();
    if (n) r = r.filter((x) => [x.name, p(x.name), x.idNumber, company(x.companyId).name, p(company(x.companyId).name)].some((v) => v.toLowerCase().includes(n)));
    return [...r].sort((a, b) => b.admittedAt - a.admittedAt);
  }, [list, filter, q, company, p]);

  const treatment = list.filter((p) => p.status === "in_treatment").length;
  const waiting = list.filter((p) => WAITING.includes(p.status)).length;
  const late = list.filter((p) => isLate(p, now)).length;

  return (
    <div className="page">
      <PageHeader
        title={t("Patients")}
        meta={
          <>
            {t("{a} in treatment · {b} waiting for transport", { a: treatment, b: waiting })}
            {late > 0 && <span className="t-red"> · {t("{n} vehicle late", { n: late })}</span>}
          </>
        }
      />
      <div className="filters">
        <div className="tabs" role="tablist" aria-label={t("Filter")}>
          {([["active", "Active"], ["treatment", "In treatment"], ["waiting", "Waiting"], ["left", "Left"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {t(l)}
            </button>
          ))}
        </div>
        <label className="search">
          <LuSearch aria-hidden="true" />
          <input id="patient-search" placeholder={t("Name, ID or company")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Pilgrim")}</th>
              <th>{t("ID")}</th>
              <th>{t("Company")}</th>
              <th>{t("Status")}</th>
              <th className="r">{t("Since")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="clickable" tabIndex={0} onClick={() => onOpen(x.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(x.id)}>
                <td>
                  <span className="name">{p(x.name)}</span>
                  <span className="dim"> · {t("{country}, {age}", { country: x.nationality, age: x.age })}</span>
                </td>
                <td className="mono dim">{x.idNumber}</td>
                <td>{p(company(x.companyId).name)}</td>
                <td>
                  <StatusText p={x} now={now} />
                </td>
                <td className="mono r">{sinceCell(x, now, T)}</td>
              </tr>
            ))}
            {!rows.length && <EmptyRow cols={5} text={t("No patients match this filter.")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sinceCell(p: Pilgrim, now: number, { t, dur }: T) {
  if (p.status === "in_treatment")
    return (
      t("{time} ({dur})", { time: fmtTime(p.admittedAt), dur: dur(minutes(now - p.admittedAt)) }) +
      (p.expectedReadyAt ? t(" · ready ~{time}", { time: fmtTime(p.expectedReadyAt) }) : "")
    );
  if (WAITING.includes(p.status)) return t("{time} ({dur})", { time: fmtTime(p.pickup!.requestedAt), dur: dur(minutes(now - p.pickup!.requestedAt)) });
  if (p.pickup?.pickedUpAt) return t("left {time}", { time: fmtTime(p.pickup.pickedUpAt) });
  return "";
}

// ---------------------------------------------------------------------------

function PatientDrawer({ p, onClose }: { p: Pilgrim | null; onClose: () => void }) {
  const { company, driver, now, hospital } = useStore();
  const { t, p: pn, tr, dur } = useT();
  const [readyOpen, setReadyOpen] = useState(false);
  const [dxOpen, setDxOpen] = useState(false);
  if (!p) return null;
  const c = company(p.companyId);
  const d = driver(p.pickup?.driverId);
  const late = isLate(p, now);

  return (
    <Drawer open={!!p} onClose={onClose} title={pn(p.name)} sub={<StatusText p={p} now={now} />}>
      {p.status === "in_treatment" && !p.diagnosedAt && (
        <div className="d-sec">
          <div className="row-actions">
            <button className="btn primary" onClick={() => setDxOpen(true)}>
              {t("Record diagnosis")}
            </button>
            <button className="btn" onClick={() => setReadyOpen(true)}>
              {t("Ready for transport")}
            </button>
          </div>
          <p className="dim small">{t("The diagnosis stays in the hospital. {company} is told only the expected ready time.", { company: c.name })}</p>
        </div>
      )}
      {p.status === "in_treatment" && p.diagnosedAt && (
        <div className="d-sec">
          <p className="note">
            {now > p.expectedReadyAt!
              ? t("Expected ready around {time}, {dur} ago. Shared with {company}.", { time: fmtTime(p.expectedReadyAt!), dur: dur(minutes(now - p.expectedReadyAt!)), company: c.name })
              : t("Expected ready around {time}, in {dur}. Shared with {company}.", { time: fmtTime(p.expectedReadyAt!), dur: dur(minutes(p.expectedReadyAt! - now)), company: c.name })}
          </p>
          <div className="row-actions">
            <button className="btn primary" onClick={() => setReadyOpen(true)}>
              {t("Ready for transport")}
            </button>
            <button className="btn" onClick={() => setDxOpen(true)}>
              {t("Change estimate")}
            </button>
          </div>
        </div>
      )}
      {p.status !== "in_treatment" && (
        <div className="d-sec">
          <Steps p={p} />
          {p.status === "ready" && <p className="note amber">{t("Waiting for {company} to send a vehicle.", { company: c.name })}</p>}
          {p.status === "ride_requested" && <p className="note amber">{t("{company} requested a Rabt ride. The fleet partner is assigning a driver.", { company: c.name })}</p>}
          {p.status === "assigned" && d && <p className="note">{t("{driver} assigned ({vehicle}, {plate}). Not accepted yet.", { driver: d.name, vehicle: d.vehicle, plate: d.plate })}</p>}
          {p.status === "accepted" && d && (
            <p className={`note ${late ? "red" : ""}`}>
              {late
                ? t("{driver} due {time}, {n} min late · {vehicle} {plate}", { driver: d.name, time: fmtTime(p.pickup!.eta!), n: minutes(now - p.pickup!.eta!), vehicle: d.vehicle, plate: d.plate })
                : t("{driver} due {time} · {vehicle} {plate}", { driver: d.name, time: fmtTime(p.pickup!.eta!), vehicle: d.vehicle, plate: d.plate })}
            </p>
          )}
        </div>
      )}
      <div className="d-sec">
        <dl className="dl">
          <dt>{t(p.idType === "nusuk" ? "Nusuk card" : "Booking")}</dt>
          <dd className="mono">{p.idNumber}</dd>
          <dt>{t("Company")}</dt>
          <dd>{t("{company} ({type})", { company: c.name, type: t(c.type === "umrah" ? "Umrah" : "Hajj") })}</dd>
          <dt>{t("Nationality")}</dt>
          <dd>{t("{country}, {age}", { country: p.nationality, age: p.age })}</dd>
          <dt>{t("Accommodation")}</dt>
          <dd>{pn(p.accommodation)}</dd>
          <dt>{t("Admitted")}</dt>
          <dd>{t("{time}, {hospital}", { time: fmtTime(p.admittedAt), hospital: hospital(p.hospitalId).name })}</dd>
          {p.checklist && (
            <>
              <dt>{t("Mobility")}</dt>
              <dd>{t(p.checklist.mobility === "wheelchair" ? "Wheelchair" : "Walking")}</dd>
            </>
          )}
          <dt>{t("Clinical note")}</dt>
          <dd>
            {p.condition ? `${t(conditionLabel(p.condition))}: ` : ""}
            <span dir="auto">{tr(p.clinicalNote)}</span> <span className="dim">{t("(hospital only)")}</span>
          </dd>
        </dl>
      </div>
      <div className="d-sec">
        <div className="label">{t("Timeline")}</div>
        <Timeline p={p} />
      </div>
      <ReadyModal p={p} open={readyOpen} onClose={() => setReadyOpen(false)} />
      <DiagnoseModal key={p.id + String(dxOpen)} p={p} open={dxOpen} onClose={() => setDxOpen(false)} />
    </Drawer>
  );
}

function DiagnoseModal({ p, open, onClose }: { p: Pilgrim; open: boolean; onClose: () => void }) {
  const { diagnose, company } = useStore();
  const { t, p: pn, lang, dur } = useT();
  const [cond, setCond] = useState(p.condition ?? "");
  const [note, setNote] = useState(p.diagnosedAt ? p.clinicalNote : "");
  const [stay, setStay] = useState<number | null>(null);
  const suggestion = cond ? suggestedStay(cond) : null;
  const chosen = stay ?? suggestion;
  const c = company(p.companyId);

  return (
    <Modal open={open} onClose={onClose} title={t("Diagnosis for {name}", { name: p.name })}>
      <fieldset className="radios">
        <legend className="label">{t("Condition group")}</legend>
        {CONDITIONS.map((x) => (
          <label key={x.id} className="radio">
            <input id={`cond-${x.id}`} type="radio" name="cond" checked={cond === x.id} onChange={() => { setCond(x.id); setStay(null); }} />
            <span>{t(x.label)}</span>
          </label>
        ))}
      </fieldset>
      <Field label={t("Clinical note (optional, hospital only)")} htmlFor="dx-note">
        <input id="dx-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. IV fluids, observe 2 h")} />
      </Field>
      <fieldset className="radios inline">
        <legend className="label">{t("Expected ready in")}</legend>
        {STAY_CHOICES.map((m) => (
          <label key={m} className="radio">
            <input id={`stay-${m}`} type="radio" name="stay" checked={chosen === m} onChange={() => setStay(m)} />
            <span>{dur(m)}</span>
          </label>
        ))}
      </fieldset>
      {suggestion && (
        <p className="dim small">
          {t("Rabt suggests {dur}, typical for {condition} (sample figures).", { dur: dur(suggestion), condition: lang === "ar" ? t(conditionLabel(cond)) : conditionLabel(cond).toLowerCase() })}
        </p>
      )}
      <p className="dim small">{t("{company} receives the expected ready time only, never the diagnosis.", { company: c.name })}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="btn primary"
          disabled={!cond || !chosen}
          onClick={() => {
            diagnose(p.id, { conditionId: cond, note, stayMin: chosen! });
            onClose();
          }}
        >
          {t("Save and tell {company}", { company: c.name })}
        </button>
      </div>
    </Modal>
  );
}

function ReadyModal({ p, open, onClose }: { p: Pilgrim; open: boolean; onClose: () => void }) {
  const { markReady, company } = useStore();
  const { t } = useT();
  const [medicines, setMedicines] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [mobility, setMobility] = useState<Mobility>("walking");
  const ok = medicines && instructions && cleared;

  return (
    <Modal open={open} onClose={onClose} title={t("Ready for transport")}>
      <div className="checks">
        <label className="check">
          <input id="chk-med" type="checkbox" checked={medicines} onChange={(e) => setMedicines(e.target.checked)} />
          <span>{t("Discharge medicines dispensed")}</span>
        </label>
        <label className="check">
          <input id="chk-inst" type="checkbox" checked={instructions} onChange={(e) => setInstructions(e.target.checked)} />
          <span>{t("Discharge instructions given in the patient's language")}</span>
        </label>
        <label className="check">
          <input id="chk-clear" type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
          <span>{t("Cleared for ordinary transport, no medical escort")}</span>
        </label>
      </div>
      <fieldset className="radios">
        <legend className="label">{t("Mobility")}</legend>
        {(["walking", "wheelchair"] as Mobility[]).map((m) => (
          <label key={m} className="radio">
            <input id={`mob-${m}`} type="radio" name="mobility" checked={mobility === m} onChange={() => setMobility(m)} />
            <span>{t(m === "walking" ? "Walking" : "Wheelchair, accessible vehicle needed")}</span>
          </label>
        ))}
      </fieldset>
      <p className="dim small">{t("Patients needing an ambulance or medical escort go through the hospital's clinical transfer, not Rabt.")}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => {
            markReady(p.id, { medicines, instructions, cleared, mobility });
            onClose();
          }}
        >
          {t("Send request to {company}", { company: company(p.companyId).name })}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Register({ hospitalId, onDone }: { hospitalId: string; onDone: (id: string) => void }) {
  const { lookup, register, company, state } = useStore();
  const { t, p } = useT();
  const [idType, setIdType] = useState<DirectoryEntry["idType"]>("nusuk");
  const [idNumber, setIdNumber] = useState("");
  const [result, setResult] = useState<DirectoryEntry | Pilgrim | null | "none">(null);
  const samples = state.directory.filter((d) => d.idType === idType && !state.pilgrims.some((p) => p.idNumber === d.idNumber && p.status !== "arrived"));
  const doLookup = (n = idNumber) => setResult(lookup(idType, n) ?? "none");

  return (
    <div className="page narrow">
      <PageHeader title={t("Register pilgrim")} meta={t("Links this visit to the company responsible for the pilgrim.")} />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          doLookup();
        }}
      >
        <fieldset className="radios inline">
          <legend className="label">{t("Identify by")}</legend>
          <label className="radio">
            <input id="idt-nusuk" type="radio" name="idtype" checked={idType === "nusuk"} onChange={() => { setIdType("nusuk"); setResult(null); setIdNumber(""); }} />
            <span>{t("Nusuk card (Hajj)")}</span>
          </label>
          <label className="radio">
            <input id="idt-booking" type="radio" name="idtype" checked={idType === "booking"} onChange={() => { setIdType("booking"); setResult(null); setIdNumber(""); }} />
            <span>{t("Company booking (Umrah)")}</span>
          </label>
        </fieldset>
        <div className="form-row">
          <Field label={t(idType === "nusuk" ? "Card number" : "Booking reference")} htmlFor="lookup-id">
            <input id="lookup-id" dir="ltr" className="input mono" placeholder={idType === "nusuk" ? "NSK-0000000" : "UMR-00000"} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </Field>
          <button className="btn primary" type="submit" disabled={!idNumber.trim()}>
            {t("Look up")}
          </button>
        </div>
        {samples.length > 0 && (
          <div className="small dim">
            {t("Sample numbers:")}{" "}
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

      {result === "none" && <p className="note red">{t("No pilgrim found with that number.")}</p>}
      {result && result !== "none" && "status" in result && <p className="note">{t("{name} is already registered.", { name: result.name })}</p>}
      {result && result !== "none" && !("status" in result) && (
        <div className="result">
          <div className="result-name">{p(result.name)}</div>
          <dl className="dl">
            <dt>{t("Nationality")}</dt>
            <dd>{t("{country}, {age}", { country: result.nationality, age: result.age })}</dd>
            <dt>{t("Company")}</dt>
            <dd>{t("{company} ({type})", { company: company(result.companyId).name, type: t(company(result.companyId).type === "umrah" ? "Umrah" : "Hajj") })}</dd>
            <dt>{t("Company manager")}</dt>
            <dd>{p(company(result.companyId).manager)}</dd>
            <dt>{t("Accommodation")}</dt>
            <dd>{p(result.accommodation)}</dd>
          </dl>
          <div className="modal-actions start">
            <button className="btn primary" onClick={() => onDone(register(hospitalId, result))}>
              {t("Register at emergency")}
            </button>
          </div>
          <p className="dim small">{t("The company is told their pilgrim is at this hospital. No diagnosis is shared.")}</p>
        </div>
      )}
      <p className="dim small">{t("Prototype lookup with sample records. A live version needs authorised access to Nusuk and company booking data.")}</p>
    </div>
  );
}
