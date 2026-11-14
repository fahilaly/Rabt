// End-to-end checks for the Rabt prototype.
// Builds nothing itself: run `npm test`, which builds the single-file app first.
// Each scenario drives the real UI in a headless browser and checks the result.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright")));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = "file://" + path.join(root, "dist/rabt-console.html");
const KEY = "rabt-prototype-v1";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};

const browser = await chromium.launch();
const errors = [];

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("rabt-welcomed", "1");
    localStorage.setItem("rabt-lang", "en");
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForTimeout(500);
  return page;
}
const state = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const nav = (page, text) => page.locator(".nav-item", { hasText: text }).first().click();
const role = (page, text) => page.locator(".role-switch button", { hasText: text }).click();
const closeNote = async (page) => {
  const stay = page.locator(".elsewhere .btn").first();
  if (await stay.count()) await stay.click();
};

// 1. Guided demo: one pilgrim from arrival to home in ten steps
{
  const page = await open();
  await page.locator(".demo-start").click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 9; i++) {
    if (await page.locator(".demo-scene").count()) await page.locator(".demo-scene").click();
    await page.waitForTimeout(450);
    await page.locator(".demo-bar .btn.primary").click();
    await page.waitForTimeout(450);
  }
  const s = await state(page);
  const ahmad = s.pilgrims.find((p) => p.name.startsWith("Ahmad"));
  check("Demo: all 10 steps run and the pilgrim arrives home", ahmad?.status === "arrived" && s.demo?.step === 9, `status ${ahmad?.status}`);
  check("Pilgrim registered: company found and alerted", s.messages.some((m) => m.to.kind === "company" && m.text.includes(ahmad.name)));
  check("Vehicle late: hospital and company alerted", s.notices.some((n) => /late/i.test(n.text) && n.pilgrimId === ahmad.id));
  const fam = s.messages.filter((m) => m.to.kind === "family" && m.to.id === ahmad.id);
  const medical = [ahmad.clinicalNote, ahmad.condition, "heat", "exhaustion", "diagnos"].filter(Boolean);
  const famLeak = fam.some((m) => medical.some((w) => m.text.toLowerCase().includes(String(w).toLowerCase())));
  check("Family SMS at ready, car on the way and arrived, nothing medical", fam.length === 3 && !famLeak, `${fam.length} messages`);
  await page.context().close();
}

// 2. Diagnosis: the company sees the ready time, never the diagnosis
{
  const page = await open();
  await nav(page, "Patients");
  await page.locator("tr", { hasText: "Hassan Abdel-Rahman" }).locator("button", { hasText: "Record diagnosis" }).click();
  await page.locator("#cond-chest").check();
  await page.locator(".modal input[name=stay]").nth(1).check();
  await page.locator(".modal .btn.primary").click();
  await page.waitForTimeout(300);
  const s = await state(page);
  const hassan = s.pilgrims.find((p) => p.name.startsWith("Hassan"));
  const toCompany = [...s.messages.filter((m) => m.to.kind === "company"), ...s.notices.filter((n) => n.audience.kind === "company")]
    .map((x) => x.text)
    .filter((t) => t.includes(hassan.name));
  const leaks = toCompany.some((t) => /chest|pain|sprain|x-ray/i.test(t));
  check("Doctor sets ready time: company sees the time, not the diagnosis", !!hassan.expectedReadyAt && toCompany.length > 0 && !leaks);
  await page.context().close();
}

// 2b. Family view: status only, nothing medical
{
  const page = await open();
  await nav(page, "Patients");
  const st = await state(page);
  const target = st.pilgrims.find((p) => p.family && p.hospitalId === "h1" && p.clinicalNote);
  await page.locator(`tr[data-pid="${target.id}"] td`).first().click();
  await page.waitForTimeout(300);
  await page.locator(".family-sec .btn", { hasText: "Family view" }).click();
  await page.waitForTimeout(300);
  const text = (await page.locator("[data-family-view]").textContent()) ?? "";
  const words = [target.clinicalNote, ...target.clinicalNote.split(/[ ,]+/).filter((w) => w.length > 4)].filter(Boolean);
  const leak = words.some((w) => text.toLowerCase().includes(String(w).toLowerCase()));
  check("Family view shows the journey, no clinical note", text.includes("Back at the accommodation") && !leak);
  await page.context().close();
}

// 2c. Next 3 hours forecast matches the expected ready times
{
  const page = await open();
  await nav(page, "Patients");
  const st = await state(page);
  const now = await page.evaluate(() => Date.now());
  const off = st.clockOffset * 60000;
  const here = st.pilgrims.filter((p) => p.hospitalId === "h1" && p.status === "in_treatment" && p.expectedReadyAt);
  const firstHour = here.filter((p) => p.expectedReadyAt - (now + off) < 3600000).length;
  const shown = Number(await page.locator(".fc-hour .fc-num").first().textContent());
  check("Next 3 hours forecast matches the expected ready times", (await page.locator(".forecast").count()) === 1 && shown === firstHour, `shown ${shown}, expected ${firstHour}`);
  await page.context().close();
}

// 3. Escalation: reminder, second contact, ride offered at 30 minutes
{
  const page = await open();
  await page.locator("summary", { hasText: "Demo tools" }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "+15 min" }).click();
    await page.waitForTimeout(300);
  }
  const s = await state(page);
  const texts = s.messages.map((m) => m.text);
  const ok = texts.some((t) => t.includes("REMINDER")) && texts.some((t) => t.includes("ESCALATION")) && texts.some((t) => t.includes("waited 30 min"));
  check("Company silent: reminder, 2nd contact, ride offered at 30 min", ok);
  await page.context().close();
}

// 4. Handover: nurse must confirm the driver and plate check first
{
  const page = await open();
  await nav(page, "Patients");
  const before = await state(page);
  const target = before.pilgrims.find((p) => p.hospitalId === "h1" && ["accepted", "assigned"].includes(p.status));
  await page.locator(`tr[data-pid="${target.id}"] button`, { hasText: "Confirm handover" }).click();
  const blocked = await page.locator(".modal .btn.primary").isDisabled();
  await page.locator("#ho-check").check();
  await page.locator(".modal .btn.primary").click();
  await page.waitForTimeout(300);
  const handed = (await state(page)).pilgrims.find((p) => p.id === target.id).status === "picked_up";
  check("Handover only after the nurse checks driver and plate", blocked && handed);
  await page.context().close();
}

// 5. Report a problem: the company fixes it and the hospital is told
{
  const page = await open();
  await nav(page, "Patients");
  const before = await state(page);
  const target = before.pilgrims.find((p) => p.hospitalId === "h1" && p.pickup && ["accepted", "assigned"].includes(p.status));
  await page.locator(`tr[data-pid="${target.id}"] td`).first().click();
  await page.waitForTimeout(300);
  await page.locator(".complaints .btn").click();
  await page.locator("#cx-0").check();
  await page.locator(".modal .btn.primary").click();
  await page.waitForTimeout(400);
  await page.locator(".elsewhere .btn.primary").click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.locator(".cx-company .btn.primary").first().click();
  await page.waitForTimeout(400);
  const s = await state(page);
  const cx = s.pilgrims.find((p) => p.id === target.id).complaints?.[0];
  const told = s.notices.some((n) => n.audience.kind === "hospital" && n.pilgrimId === target.id && /fixed/.test(n.text));
  check("Problem reported: company fixes it, hospital is told", !!cx?.resolvedAt && told);
  await closeNote(page);
  await page.context().close();
}

// 7. Busiest pickup hours on the scorecard
{
  const page = await open();
  await page.locator(".side-about .nav-item", { hasText: "Company scorecard" }).click();
  await page.waitForTimeout(300);
  const bars = await page.locator(".hours-card rect").count();
  const advice = (await page.locator(".hours-card p.strong").textContent()) ?? "";
  const label = (await page.locator(".hours-card").textContent()) ?? "";
  check("Busiest hours chart: 24 bars, sample data labelled, advice given", bars === 24 && /sample data/i.test(label) && /between 12:00 and 14:00/.test(advice), advice);
  await page.context().close();
}

// 8. Today's report matches the recorded times
{
  const page = await open();
  await nav(page, "Today's report");
  await page.waitForTimeout(300);
  const st = await state(page);
  const now = await page.evaluate(() => Date.now()) + st.clockOffset * 60000;
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const left = st.pilgrims.filter((p) => p.hospitalId === "h1" && p.pickup?.pickedUpAt >= d.getTime()).length;
  const cells = await page.locator(".report-cell").count();
  const shown = Number(await page.locator(".report-cell .report-num").first().textContent());
  const print = await page.locator("button", { hasText: "Print" }).count();
  check("Today's report: 8 figures, departures match the records, print button", cells === 8 && shown === left && print === 1, `shown ${shown}, expected ${left}`);
  await page.context().close();
}

// 9. Wheelchair matching when sending a car
{
  const page = await open();
  await role(page, "Company");
  await nav(page, "Pickup requests");
  await page.waitForTimeout(300);
  const st = await state(page);
  const target = st.pilgrims.find((p) => p.status === "ready" && p.checklist?.mobility === "wheelchair");
  await page.locator(`tr[data-pid="${target.id}"] button`, { hasText: "Send" }).first().click();
  await page.waitForTimeout(300);
  const firstAccessible = (await page.locator(".driver-opt").first().textContent())?.includes("Wheelchair accessible");
  const unsuitable = page.locator(".driver-opt.opt-unsuitable input").first();
  await unsuitable.check();
  const warned = (await page.locator(".modal .note.red").count()) === 1;
  check("Wheelchair: accessible cars first, warning on a mismatch", !!firstAccessible && warned);
  await page.context().close();
}

// 6. Arabic on a phone: page fits the screen
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("rabt-welcomed", "1"));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForTimeout(500);
  const dir = await page.evaluate(() => document.documentElement.dir);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  check("Arabic by default, fits a phone screen", dir === "rtl" && width <= 390, `dir ${dir}, width ${width}`);
  await ctx.close();
}

check("No page errors in any scenario", errors.length === 0, errors.join("; "));
await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
