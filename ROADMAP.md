# Rabt to-do list (MEDATHON final)

Decided:
- **Design C**: Arabic first, green sidebar, English switch.
- **No outside APIs**: travel time and expected stay are estimated inside the app, and SMS are simulated.
- **No live database work**: the demo runs inside the software.

## Done

- Hospital, company, driver and fleet screens, plus the recovery-ward board.
- Diagnosis with an expected ready time. The company sees the time only, never the diagnosis.
- Travel-time estimate when assigning a driver.
- Late alerts and simulated SMS.
- **Demo mode**: one pilgrim from arrival to home in 10 steps, with captions.
- Arabic interface with English switch.

## 1. Engineer 1: prototype polish

- [ ] Team review of design C on every screen. Collect changes in one list, then apply.
- [ ] **Impact page.** A ward-crowding simulator with sliders for patients per hour and company response time, today vs. with Rabt. It shows a chart of pilgrims waiting in the recovery ward through the day, labelled "illustrative, based on our assumptions".
- [ ] Apply the Arabic wording fixes from Pharmacy.
- [ ] Final test on the laptop you will present from: demo mode start to end, Arabic and English.

## 2. Engineer 2: demo and video

- [ ] Rehearse demo mode. Fix any caption or timing that feels slow or unclear.
- [ ] Record the backup video of demo mode (Arabic, 2–3 minutes, screen recording with voice-over).
- [ ] Take clean screenshots of each screen for the deck.
- [ ] Find out the final-round format (live demo or video, how many minutes) and fit the demo to it.

## 3. Cybersecurity: privacy and trust

- [ ] One-page privacy and security summary covering:
  - who sees what (the hospital sees everything, the company sees status and times, the driver sees pickup details);
  - the diagnosis never leaves the hospital;
  - every action is logged with time and user (the timeline);
  - PDPL alignment and how long data is kept.
- [ ] Short threat model: what could go wrong (wrong company notified, leaked phone numbers, fake pickup) and how Rabt prevents it.
- [ ] Prepared answers for "Is sharing pilgrim data with companies legal?" and "What about consent?"

## 4. Pharmacy: clinical side and evidence

- [ ] Check the clinical flow: the 3-item ready checklist, the condition groups, and the typical-stay figures (now sample numbers). Replace them with defensible figures or keep them clearly labelled as samples.
- [ ] Review the Arabic wording in the app and the demo captions.
- [ ] Check that Ahmad's demo story is realistic (heat exhaustion, 2 hours, discharge steps).
- [ ] Evidence:
  - a short note or quote from recovery-ward staff;
  - the numbers you observed, labelled as your observations;
  - if possible, a letter of interest from one hospital or Hajj/Umrah company.

## Everyone

- [ ] Update the pitch deck with screenshots and the demo story.
- [ ] Prepare answers for the judges:
  - Who pays, and how much?
  - What if the company ignores the alert?
  - Why not build this into Nusuk?
- [ ] Full rehearsal with timing.
