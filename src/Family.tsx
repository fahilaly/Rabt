import React, { useState } from "react";
import { LuUsers, LuCheck } from "react-icons/lu";
import { fmtTime, useStore } from "./store";
import { useT } from "./i18n";
import { Field, Modal } from "./ui";
import type { Pilgrim } from "./types";

// Family status page: where the pilgrim is on the way home. Nothing medical, no pickup
// code, no driver phone. In a real deployment this is a private link sent by SMS.

export function familySteps(p: Pilgrim) {
  const k = p.pickup;
  return [
    { label: "In hospital", at: p.admittedAt },
    { label: "Ready to leave", at: k?.requestedAt },
    { label: "Car on the way", at: k?.acceptedAt, eta: k?.eta },
    { label: "Left the hospital", at: k?.pickedUpAt },
    { label: "Back at the accommodation", at: k?.arrivedAt },
  ];
}

export function FamilyView({ p }: { p: Pilgrim }) {
  const { hospital } = useStore();
  const { t, p: pn } = useT();
  const steps = familySteps(p);
  const current = steps.reduce((acc, s, i) => (s.at ? i : acc), 0);
  const first = pn(p.name).split(" ")[0];
  return (
    <div className="family-phone" data-family-view>
      <div className="family-top">
        <span className="family-brand">{t("Rabt")}</span>
        <span className="dim small">{t("Family update")}</span>
      </div>
      <h3 className="family-name">{first}</h3>
      <p className="dim small family-where">{pn(hospital(p.hospitalId).name)}</p>
      <ol className="family-steps">
        {steps.map((s, i) => {
          const done = !!s.at;
          return (
            <li key={s.label} className={`${done ? "done" : ""} ${i === current ? "now" : ""}`}>
              <span className="family-dot" aria-hidden="true">
                {done && <LuCheck />}
              </span>
              <span className="family-label">{t(s.label)}</span>
              <span className="family-time mono">
                {s.at ? fmtTime(s.at) : ""}
                {i === 2 && s.at && s.eta && !steps[3].at ? ` · ${t("arriving around {time}", { time: fmtTime(s.eta) })}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="family-foot small dim">{t("Rabt shares only where your family member is on the way home. Medical information stays with the hospital.")}</p>
    </div>
  );
}

export function FamilyButton({ p }: { p: Pilgrim }) {
  const { t, p: pn } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        <LuUsers aria-hidden="true" /> {t("Family view")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("What the family sees")}>
        <p className="dim small">
          {p.family
            ? t("In a real deployment, {name} gets this page as a private link by SMS.", { name: pn(p.family.name) })
            : t("No family contact yet. In a real deployment, this page is a private link sent by SMS.")}
        </p>
        <FamilyView p={p} />
      </Modal>
    </>
  );
}

// Hospital only: add or change the family contact
export function FamilyContactSection({ p }: { p: Pilgrim }) {
  const { setFamily } = useStore();
  const { t, p: pn } = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.family?.name ?? "");
  const [phone, setPhone] = useState(p.family?.phone ?? "");
  return (
    <div className="family-sec">
      <div className="complaints-head">
        <span className="label">{t("Family contact")}</span>
        <FamilyButton p={p} />
      </div>
      {!editing ? (
        <div className="family-contact">
          {p.family ? (
            <span>
              {pn(p.family.name)} · <span className="mono" dir="ltr">{p.family.phone}</span>
            </span>
          ) : (
            <span className="dim small">{t("None. Add one so the family gets updates on the way home.")}</span>
          )}
          <button className="link" onClick={() => setEditing(true)}>
            {t(p.family ? "Change" : "Add")}
          </button>
        </div>
      ) : (
        <div className="family-edit">
          <Field label={t("Name")} htmlFor={`fam-name-${p.id}`}>
            <input id={`fam-name-${p.id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("Phone")} htmlFor={`fam-phone-${p.id}`}>
            <input id={`fam-phone-${p.id}`} className="input mono" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div className="row-actions">
            <button
              className="btn sm primary"
              disabled={!name.trim() || !phone.trim()}
              onClick={() => {
                setFamily(p.id, { name: name.trim(), phone: phone.trim() });
                setEditing(false);
              }}
            >
              {t("Save")}
            </button>
            {p.family && (
              <button
                className="btn sm"
                onClick={() => {
                  setFamily(p.id, undefined);
                  setName("");
                  setPhone("");
                  setEditing(false);
                }}
              >
                {t("Remove")}
              </button>
            )}
            <button className="btn sm" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
