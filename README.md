# Rabt Console (prototype v2)

Rabt connects Hajj and Umrah hospitals with the company responsible for each pilgrim:
the hospital confirms a pilgrim is ready for transport, the company sends a vehicle
(its own, or a Rabt ride from the licensed fleet partner), and every step is timestamped
until the pilgrim is back at their accommodation.

This is a working front end with sample data. Everything runs in the browser, and open
tabs stay in sync with each other.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Open two tabs (one as **Hospital**, one as **Company**, using the switch at the top of the
sidebar) to watch changes appear in both. Keys **1**, **2** and **3** also switch role.

## The three portals

| Portal | Screens | Main actions |
|---|---|---|
| Hospital | Recovery ward board, Patients, Register pilgrim | Register by Nusuk card or Umrah booking (mock lookup); "Ready for transport" checklist |
| Company | Pickup requests, Pilgrims in hospital, Completed | Send own vehicle (choose driver); request a Rabt ride (Full plan only) |
| Transport | Driver app (phone layout), Fleet dispatch | Driver: accept with arrival time, picked up, arrived. Dispatcher: assign partner drivers to Rabt rides |

The sidebar also has a **demo clock** (+5 / +15 min, reset sample data) for showing waiting
times and late alerts.

## Status flow

```
in_treatment → ready → (ride_requested) → assigned → accepted → picked_up → arrived
                                                       └─ "late" when now > promised arrival time
```

- `ready` = hospital confirmed the checklist; a pickup request goes to the company.
- `ride_requested` only happens on the Full plan (Rabt ride via the fleet partner).
- A late vehicle raises one alert to the company manager and the hospital.

## Code map

| File | What it holds |
|---|---|
| `src/types.ts` | Data model: hospitals, companies, drivers, pilgrims, pickups, timeline events, notifications |
| `src/seed.ts` | Sample data (all names invented) |
| `src/store.tsx` | State, actions, late detection, browser storage, tab sync |
| `src/eta.ts` | Travel-time estimate (built-in now; Google Routes or OSRM examples for later) |
| `src/HospitalPortal.tsx` | Ward board, patient list and drawer, ready checklist, register |
| `src/CompanyPortal.tsx` | Pickup requests, assign vehicle, my pilgrims, history |
| `src/TransportPortal.tsx` | Driver app, fleet dispatch |
| `src/App.tsx` | Shell: sidebar with role and persona, section nav, notifications, demo clock |
| `src/ui.tsx` | Shared pieces: status text, page header, steps, timeline, drawer, modal, privacy note |
| `src/styles.css` | Design tokens (light and dark) and all styles |

## Design rules

The look is a working console (think Linear, Onfleet, NHS and GOV.UK services), not a
template dashboard. Keep it that way when adding screens:

- **Layout:** fixed left sidebar (role, sections, demo clock); work happens in dense tables
  with the action in the row. Details open in a side drawer, not a new page.
- **Recovery ward:** an airport-style departures board, always dark, with English and
  Arabic column headers. Late rows turn red. Built to sit on a ward screen.
- **Colour:** neutral greys plus one accent, Saudi green `#006C35`. Amber = waiting,
  blue = moving, red = late. Colours live as tokens at the top of `styles.css` (light and dark).
- **Type:** IBM Plex Sans / Plex Sans Arabic; Plex Mono for times, IDs and plates. 24-hour times.
- **Status:** a small square plus a plain sentence ("Waiting for company", "Late 6 min").
- **Avoid:** rows of big number tiles, rounded cards with soft shadows, pastel pill badges,
  initials in circles, gradients, and explanatory subtitles under every heading.

## Connecting a real backend

All writes go through the action functions in `src/store.tsx`
(`register`, `markReady`, `assignOwn`, `requestRide`, `dispatchAssign`, `accept`,
`pickedUp`, `arrived`). To move to Firebase or Supabase:

1. Store `pilgrims`, `drivers`, `companies`, `hospitals` and `notices` as tables or collections.
2. Replace `load` / `save` / the `BroadcastChannel` sync with a realtime subscription.
3. Turn each action into a backend write (ideally a server function that checks the
   caller's role), keeping the same event labels for the timeline.
4. Add real logins per role; each role should only receive the fields it may see
   (companies never receive `clinicalNote`).

## Privacy rules the prototype already follows

- Companies and drivers never see the diagnosis or clinical notes (`clinicalNote` is shown
  only in the hospital portal, labelled "Hospital only").
- Companies see: name, ID, hospital, stage, expected pickup time, mobility.
- Every change is recorded on the pilgrim's timeline with who did it and when.

## What's left

See [ROADMAP.md](ROADMAP.md): demo tasks first, then the real travel-time API, then what a pilot needs.
