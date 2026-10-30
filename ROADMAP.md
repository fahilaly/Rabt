# What's left

Status as of 30 Oct 2026. The prototype covers the whole pickup flow with sample data.
The list below starts with what the MEDATHON demo needs and ends with what a real pilot needs.

Size: **S** = an evening, **M** = 2–4 days, **L** = a week or more.

## Already working

- Hospital: register a pilgrim (mock Nusuk / booking lookup), "Ready for transport" checklist,
  patient list and timeline, recovery-ward departures board.
- Company: pickup requests, send own vehicle, request a Rabt ride (Full plan), history with median wait.
- Transport: driver app (accept with arrival time, picked up, arrived), fleet dispatch.
- Late alerts, a demo clock (+5 / +15 min), and live sync between tabs **in the same browser**.
- Travel-time estimate (`src/eta.ts`): a built-in estimate from coordinates, shown when
  assigning a driver, in dispatch, in the driver app and on the ward board (`~03:04`).
- Diagnosis with an expected ready time (Rabt suggests a typical stay); the company sees
  only the time (`src/stay.ts`).
- **Demo mode**: the full journey in 10 steps with captions, Play / Next / Follow.
- Simulated SMS to company managers and drivers (Messages panel and pop-up).
- **Sync across devices** on the published link (`src/sync.ts`).

Decided: no outside APIs for the competition. Travel time and stay are estimated in the app;
SMS are simulated.

## 1. For the demo (do first)

| # | Task | Size | Why it matters |
|---|---|---|---|
| 1 | ~~Sync across devices~~ Done on the published link. Only needed again if the app moves off claude.ai (then Supabase or Firebase). | – | |
| 2 | ~~Guided demo~~ Done (demo mode). Next: rehearse it, tune captions, record a backup video of it. | S | |
| 3 | **Impact page**: ward-crowding simulator (patients per hour, company response time today vs. with Rabt), labelled as illustrative. | M | Shows the Track 1 crowd-flow result, not just screens. |
| 4 | **Arabic interface.** RTL layout and Arabic text, starting with the ward board and the driver app. | M | Most real users work in Arabic. |
| 5 | **Visual pass.** The team's own edits to the look. Design rules are in the README. | S–M | |

## 2. Real travel-time estimate

| # | Task | Size |
|---|---|---|
| 6 | Driver's live position from the phone (browser Geolocation API), saved every 30–60 s while on a trip. | S |
| 7 | Server function that calls a maps API and returns minutes. Two options are already written out in `src/eta.ts`: **Google Routes API** (includes live traffic, paid per request) or **OSRM** (free and open source, no live traffic, self-host for production). Keep the API key on the server. | M |
| 8 | Cache each driver's estimate for 1–2 minutes and fall back to the built-in estimate if the API fails. | S |
| 9 | Later: learn from our own data. Compare estimated with actual arrival times (both are already timestamped) and correct the estimate by area and hour. | L |

## 3. For a pilot

| # | Task | Size |
|---|---|---|
| 10 | Logins per role (ward staff, company manager, driver, fleet dispatcher), with each role only able to read its own data (for example Supabase row-level security). | M |
| 11 | Messages outside the app: SMS or WhatsApp to the company manager and the driver for new requests and late vehicles (for example Unifonic or the WhatsApp Business API). | M |
| 12 | Real lookups: Nusuk card for Hajj, company booking records for Umrah. Needs agreements with the Ministry of Hajj and Umrah and the companies; the prototype uses a mock. | L |
| 13 | Reports for hospitals and the Ministry: waiting time per company, late-vehicle rate, busiest hours. | M |
| 14 | Privacy and security: PDPL review, audit log of who changed what, how long records are kept, a threat model. The prototype already keeps diagnoses inside the hospital. | M |
| 15 | Fleet partner contract and dispatch rules (pricing for the Full plan, response-time targets). | Business |

## Suggested split (4 people)

- **Engineer 1:** tasks 1, 2 and 10 (backend, deploy, logins).
- **Engineer 2:** tasks 3, 6, 7 and 8 (guided demo, GPS, maps API).
- **Cybersecurity:** tasks 10 and 14 with Engineer 1 (roles, data access, privacy).
- **Pharmacy:** checklist wording and discharge steps with recovery-ward staff, Arabic
  wording (task 4), and checking the clinical side of the demo story.
