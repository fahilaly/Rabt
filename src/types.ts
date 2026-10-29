// Rabt data model. One record per pilgrim; every change is a timestamped event.

export type CompanyType = "umrah" | "hajj";
export type Plan = "basic" | "full";

export interface Hospital {
  id: string;
  name: string;
  area: string;
  wardPhone: string;
  lat: number;
  lng: number;
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  plan: Plan; // basic = own vehicles only, full = can request a Rabt ride
  manager: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  wheelchair: boolean;
  // a company's own driver, or null for the licensed fleet partner
  companyId: string | null;
  // last known position (a live version gets this from the driver's phone GPS)
  at: string;
  lat: number;
  lng: number;
}

export type Status =
  | "in_treatment" // admitted / being treated
  | "ready" // hospital confirmed ready for transport, request sent to company
  | "ride_requested" // company asked the fleet partner for a Rabt ride
  | "assigned" // a driver has been assigned, waiting for the driver to accept
  | "accepted" // driver accepted and gave an arrival time
  | "picked_up" // left the hospital
  | "arrived"; // back at accommodation, case closed

export type Mobility = "walking" | "wheelchair";

export interface ReadyChecklist {
  medicines: boolean;
  instructions: boolean;
  cleared: boolean;
  mobility: Mobility;
}

export interface TimelineEvent {
  at: number; // epoch ms (demo clock)
  label: string;
  by: string;
}

export interface Pickup {
  requestedAt: number;
  mode?: "own" | "rabt";
  driverId?: string;
  assignedAt?: number;
  acceptedAt?: number;
  eta?: number; // promised arrival at the hospital
  estimateMin?: number; // Rabt's travel-time estimate when the driver was assigned
  pickedUpAt?: number;
  arrivedAt?: number;
  lateAlertSent?: boolean;
}

export interface Pilgrim {
  id: string;
  name: string;
  nationality: string;
  age: number;
  idType: "nusuk" | "booking";
  idNumber: string;
  companyId: string;
  hospitalId: string;
  accommodation: string;
  admittedAt: number;
  status: Status;
  checklist?: ReadyChecklist;
  pickup?: Pickup;
  events: TimelineEvent[];
  // Kept inside the hospital only. Never shown to companies or drivers.
  clinicalNote: string;
}

export interface Notice {
  id: string;
  at: number;
  audience: { kind: "company" | "hospital" | "dispatch" | "driver"; id: string };
  text: string;
  tone: "info" | "warn" | "good";
  pilgrimId?: string;
}

export interface State {
  version: number;
  clockOffset: number; // demo clock: minutes added to real time
  hospitals: Hospital[];
  companies: Company[];
  drivers: Driver[];
  pilgrims: Pilgrim[];
  notices: Notice[];
  directory: DirectoryEntry[]; // mock Nusuk / booking lookup
}

// What a Nusuk card or company booking lookup returns (mock).
export interface DirectoryEntry {
  idType: "nusuk" | "booking";
  idNumber: string;
  name: string;
  nationality: string;
  age: number;
  companyId: string;
  accommodation: string;
}
