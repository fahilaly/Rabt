# Rabt Console (prototype v3)

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

## Demo mode

Press **Start demo** in the sidebar. It plays one pilgrim's journey on the real app, ten steps
with a caption each:

1. Arrives at emergency (registered by booking number) → 2. company told by SMS →
3. diagnosis and expected stay (Rabt suggests a typical stay) → 4. company sees the expected
ready time only → 5. nurse marks Ready for transport → 6. nearest company vehicle assigned →
7. driver accepts with an arrival time → 8. vehicle runs late, alert sent → 9. picked up → 10. home.

**Next** runs one step, **Play** runs them every 9 seconds, **Follow** makes the screen jump to
each step's view (turn it off on a device that should stay on one role). The demo resets the
sample data when it starts, and moves only the demo pilgrim's times, so other patients stay realistic.

**Messages** shows the SMS Rabt would send (simulated; nothing is sent).

## Two devices

On the published claude.ai link, every device that opens it (signed in to the same account or
organization) shares one copy of the data, so a phone can be the driver while a laptop shows the
ward board. Code: `src/sync.ts`. Under `npm run dev` it syncs between tabs of one browser only.

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
| `src/stay.ts` | Expected-stay suggestions by condition group (sample figures) |
| `src/Demo.tsx` | Demo mode steps and player, simulated SMS panel |
| `src/sync.ts` | Shared data across devices on the published link |
| `src/i18n.tsx` | Arabic / English text, names and places |
| `src/HospitalPortal.tsx` | Ward board, patient list and drawer, ready checklist, register |
| `src/CompanyPortal.tsx` | Pickup requests, assign vehicle, my pilgrims, history |
| `src/TransportPortal.tsx` | Driver app, fleet dispatch |
| `src/App.tsx` | Shell: sidebar with role and persona, section nav, notifications, demo clock |
| `src/ui.tsx` | Shared pieces: status text, page header, steps, timeline, drawer, modal, privacy note |
| `src/styles.css` | Design tokens (light and dark) and all styles |

## Design rules (design C, chosen by the team)

- **Arabic first.** The interface opens in Arabic, right to left; the English switch sits at the
  bottom of the sidebar. All text goes through `t()` in `src/i18n.tsx` (English is the key,
  Arabic the value). Names and places from the sample data go through `p()`. Stored notices,
  timeline entries and SMS are saved in English and shown in Arabic by `tr()`.
- **Layout:** green sidebar (role tabs, hospital or company, sections, demo controls), white work
  area with bordered lists and tables, actions in the row, details in a side drawer.
- **Recovery ward:** the dark departures board with Arabic and English column headers.
- **Colour:** Saudi green `#006C35` plus greys; amber = waiting, blue = moving, red = late.
- **Type:** IBM Plex Sans Arabic / IBM Plex Sans; IBM Plex Mono for times, IDs and plates.
- **Spacing:** logical CSS properties (`margin-inline-start`, `text-align: start`), so one
  stylesheet works in both directions. Do not use left/right.

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
- Companies see: name, ID, hospital, stage, expected ready time, expected pickup time, mobility.
- Every change is recorded on the pilgrim's timeline with who did it and when.

## What's left

See [ROADMAP.md](ROADMAP.md): demo tasks first, then the real travel-time API, then what a pilot needs.
