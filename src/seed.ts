import type { State, Pilgrim, TimelineEvent } from "./types";

// All names below are invented sample data for the prototype.

const MIN = 60_000;

export function makeSeed(now: number): State {
  const ago = (m: number) => now - m * MIN;
  const ev = (m: number, label: string, by: string): TimelineEvent => ({ at: ago(m), label, by });

  const pilgrims: Pilgrim[] = [
    // --- in treatment ---
    {
      id: "p1", name: "Siti Rahmawati", nationality: "Indonesia", age: 64, idType: "booking", idNumber: "UMR-58213",
      companyId: "c1", hospitalId: "h1", accommodation: "Ibrahim Al-Khalil St, Tower B, room 1412",
      admittedAt: ago(190), status: "in_treatment", clinicalNote: "Dehydration, IV fluids",
      events: [ev(190, "Registered at emergency", "Desk, Al-Haram East")],
    },
    {
      id: "p2", name: "Muhammad Aslam", nationality: "Pakistan", age: 71, idType: "nusuk", idNumber: "NSK-3390417",
      companyId: "c2", hospitalId: "h2", accommodation: "Aziziyah, Building 22, room 305",
      admittedAt: ago(1440), status: "in_treatment", clinicalNote: "Chest pain, under observation",
      events: [ev(1440, "Registered at emergency", "Desk, Mina Valley"), ev(1400, "Admitted to ward", "Ward 3, Mina Valley")],
    },
    {
      id: "p3", name: "Hassan Abdel-Rahman", nationality: "Egypt", age: 58, idType: "booking", idNumber: "UMR-61177",
      companyId: "c3", hospitalId: "h1", accommodation: "Ajyad, Al-Masa Hotel, room 818",
      admittedAt: ago(75), status: "in_treatment", clinicalNote: "Ankle sprain, X-ray pending",
      events: [ev(75, "Registered at emergency", "Desk, Al-Haram East")],
    },
    // --- ready, waiting for the company ---
    {
      id: "p4", name: "Aminah Bello", nationality: "Nigeria", age: 66, idType: "booking", idNumber: "UMR-60482",
      companyId: "c1", hospitalId: "h1", accommodation: "Ibrahim Al-Khalil St, Tower B, room 903",
      admittedAt: ago(260), status: "ready", clinicalNote: "Heat exhaustion, recovered",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "wheelchair" },
      pickup: { requestedAt: ago(14) },
      events: [ev(260, "Registered at emergency", "Desk, Al-Haram East"), ev(14, "Ready for transport, pickup requested", "Recovery ward, Al-Haram East")],
    },
    {
      id: "p5", name: "Yusuf Demir", nationality: "Türkiye", age: 52, idType: "booking", idNumber: "UMR-62005",
      companyId: "c3", hospitalId: "h3", accommodation: "Ajyad, Al-Masa Hotel, room 1203",
      admittedAt: ago(130), status: "ready", clinicalNote: "Minor laceration, sutured",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(4) },
      events: [ev(130, "Registered at emergency", "Desk, Aziziyah Medical"), ev(4, "Ready for transport, pickup requested", "Recovery ward, Aziziyah Medical")],
    },
    // --- Rabt ride requested, waiting for the fleet partner ---
    {
      id: "p6", name: "Fatima Zahra Idrissi", nationality: "Morocco", age: 69, idType: "booking", idNumber: "UMR-59934",
      companyId: "c1", hospitalId: "h3", accommodation: "Ibrahim Al-Khalil St, Tower A, room 610",
      admittedAt: ago(300), status: "ride_requested", clinicalNote: "Hypoglycaemia, stabilised",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(9), mode: "rabt" },
      events: [ev(300, "Registered at emergency", "Desk, Aziziyah Medical"), ev(9, "Ready for transport, pickup requested", "Recovery ward, Aziziyah Medical"), ev(7, "Rabt ride requested", "Al-Safwa Umrah")],
    },
    // --- assigned, driver has not accepted yet ---
    {
      id: "p7", name: "Abdullah Al-Qahtani", nationality: "Saudi Arabia", age: 74, idType: "nusuk", idNumber: "NSK-3388102",
      companyId: "c2", hospitalId: "h1", accommodation: "Mina, Camp 41, tent 12",
      admittedAt: ago(500), status: "assigned", clinicalNote: "Hypertension, medication adjusted",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(11), mode: "own", driverId: "d3", assignedAt: ago(6) },
      events: [ev(500, "Registered at emergency", "Desk, Al-Haram East"), ev(11, "Ready for transport, pickup requested", "Recovery ward, Al-Haram East"), ev(6, "Own vehicle assigned: Khalid Al-Harbi", "Rawasi Hajj Campaign")],
    },
    // --- accepted, on the way, on time ---
    {
      id: "p8", name: "Nurul Huda Ismail", nationality: "Malaysia", age: 60, idType: "booking", idNumber: "UMR-61540",
      companyId: "c1", hospitalId: "h1", accommodation: "Ibrahim Al-Khalil St, Tower B, room 1120",
      admittedAt: ago(210), status: "accepted", clinicalNote: "Gastroenteritis, recovered",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(16), mode: "own", driverId: "d1", assignedAt: ago(13), acceptedAt: ago(12), eta: now + 7 * MIN },
      events: [ev(210, "Registered at emergency", "Desk, Al-Haram East"), ev(16, "Ready for transport, pickup requested", "Recovery ward, Al-Haram East"), ev(13, "Own vehicle assigned: Saeed Al-Malki", "Al-Safwa Umrah"), ev(12, "Driver accepted, arriving in 19 min", "Saeed Al-Malki")],
    },
    // --- accepted, late ---
    {
      id: "p9", name: "Ali Reza Karimi", nationality: "Iran", age: 67, idType: "booking", idNumber: "UMR-60077",
      companyId: "c3", hospitalId: "h1", accommodation: "Ajyad, Al-Masa Hotel, room 504",
      admittedAt: ago(320), status: "accepted", clinicalNote: "Asthma attack, nebulised",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(34), mode: "rabt", driverId: "d5", assignedAt: ago(30), acceptedAt: ago(29), eta: ago(6), lateAlertSent: true },
      events: [ev(320, "Registered at emergency", "Desk, Al-Haram East"), ev(34, "Ready for transport, pickup requested", "Recovery ward, Al-Haram East"), ev(32, "Rabt ride requested", "Noor Al-Huda Tours"), ev(30, "Partner driver assigned: Majed Al-Otaibi", "Fleet dispatch"), ev(29, "Driver accepted, arriving in 23 min", "Majed Al-Otaibi"), ev(6, "Vehicle late: arrival time passed", "Rabt")],
    },
    // --- completed ---
    {
      id: "p10", name: "Ibrahim Diallo", nationality: "Senegal", age: 63, idType: "booking", idNumber: "UMR-59002",
      companyId: "c1", hospitalId: "h2", accommodation: "Ibrahim Al-Khalil St, Tower A, room 215",
      admittedAt: ago(400), status: "arrived", clinicalNote: "Fever, treated",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(120), mode: "own", driverId: "d2", assignedAt: ago(117), acceptedAt: ago(116), eta: ago(100), pickedUpAt: ago(101), arrivedAt: ago(88) },
      events: [ev(400, "Registered at emergency", "Desk, Mina Valley"), ev(120, "Ready for transport, pickup requested", "Recovery ward, Mina Valley"), ev(117, "Own vehicle assigned: Turki Al-Shehri", "Al-Safwa Umrah"), ev(116, "Driver accepted, arriving in 16 min", "Turki Al-Shehri"), ev(101, "Picked up from hospital", "Turki Al-Shehri"), ev(88, "Arrived at accommodation", "Turki Al-Shehri")],
    },
    {
      id: "p11", name: "Khadija Mansour", nationality: "Jordan", age: 57, idType: "booking", idNumber: "UMR-58740",
      companyId: "c3", hospitalId: "h3", accommodation: "Ajyad, Al-Masa Hotel, room 1009",
      admittedAt: ago(380), status: "arrived", clinicalNote: "Migraine, treated",
      checklist: { medicines: true, instructions: true, cleared: true, mobility: "walking" },
      pickup: { requestedAt: ago(170), mode: "rabt", driverId: "d4", assignedAt: ago(165), acceptedAt: ago(164), eta: ago(146), pickedUpAt: ago(144), arrivedAt: ago(131) },
      events: [ev(380, "Registered at emergency", "Desk, Aziziyah Medical"), ev(170, "Ready for transport, pickup requested", "Recovery ward, Aziziyah Medical"), ev(168, "Rabt ride requested", "Noor Al-Huda Tours"), ev(165, "Partner driver assigned: Nasser Al-Zahrani", "Fleet dispatch"), ev(164, "Driver accepted, arriving in 18 min", "Nasser Al-Zahrani"), ev(144, "Picked up from hospital", "Nasser Al-Zahrani"), ev(131, "Arrived at accommodation", "Nasser Al-Zahrani")],
    },
  ];

  return {
    version: 1,
    clockOffset: 0,
    hospitals: [
      { id: "h1", name: "Al-Haram East Hospital", area: "Central Makkah", wardPhone: "012 000 1101" },
      { id: "h2", name: "Mina Valley Hospital", area: "Mina", wardPhone: "012 000 2202" },
      { id: "h3", name: "Aziziyah Medical Center", area: "Aziziyah", wardPhone: "012 000 3303" },
    ],
    companies: [
      { id: "c1", name: "Al-Safwa Umrah", type: "umrah", plan: "full", manager: "Rakan Al-Dosari" },
      { id: "c2", name: "Rawasi Hajj Campaign", type: "hajj", plan: "basic", manager: "Omar Al-Ghamdi" },
      { id: "c3", name: "Noor Al-Huda Tours", type: "umrah", plan: "full", manager: "Hind Al-Subaie" },
    ],
    drivers: [
      { id: "d1", name: "Saeed Al-Malki", vehicle: "Toyota HiAce", plate: "KSA 4821", wheelchair: false, companyId: "c1" },
      { id: "d2", name: "Turki Al-Shehri", vehicle: "Hyundai H-1", plate: "KSA 7730", wheelchair: true, companyId: "c1" },
      { id: "d3", name: "Khalid Al-Harbi", vehicle: "Toyota Coaster", plate: "KSA 1195", wheelchair: false, companyId: "c2" },
      { id: "d4", name: "Nasser Al-Zahrani", vehicle: "Ford Transit (accessible)", plate: "KSA 3307", wheelchair: true, companyId: null },
      { id: "d5", name: "Majed Al-Otaibi", vehicle: "Toyota HiAce", plate: "KSA 5562", wheelchair: false, companyId: null },
      { id: "d6", name: "Faisal Al-Juhani", vehicle: "Hyundai Staria", plate: "KSA 9024", wheelchair: false, companyId: null },
    ],
    pilgrims,
    notices: [
      { id: "n1", at: ago(14), audience: { kind: "company", id: "c1" }, text: "Pickup requested for Aminah Bello at Al-Haram East Hospital", tone: "info", pilgrimId: "p4" },
      { id: "n2", at: ago(6), audience: { kind: "company", id: "c3" }, text: "Vehicle late for Ali Reza Karimi: arrival time passed", tone: "warn", pilgrimId: "p9" },
      { id: "n3", at: ago(7), audience: { kind: "dispatch", id: "fleet" }, text: "New Rabt ride request: Fatima Zahra Idrissi at Aziziyah Medical Center", tone: "info", pilgrimId: "p6" },
    ],
    directory: [
      { idType: "nusuk", idNumber: "NSK-3401556", name: "Saleh Al-Mutairi", nationality: "Saudi Arabia", age: 68, companyId: "c2", accommodation: "Mina, Camp 41, tent 7" },
      { idType: "booking", idNumber: "UMR-63118", name: "Ahmad Fauzi", nationality: "Indonesia", age: 59, companyId: "c1", accommodation: "Ibrahim Al-Khalil St, Tower A, room 1702" },
      { idType: "booking", idNumber: "UMR-63540", name: "Mariam Haddad", nationality: "Lebanon", age: 62, companyId: "c3", accommodation: "Ajyad, Al-Masa Hotel, room 711" },
      { idType: "nusuk", idNumber: "NSK-3399870", name: "Bilal Chaudhry", nationality: "Pakistan", age: 55, companyId: "c2", accommodation: "Aziziyah, Building 22, room 118" },
    ],
  };
}
