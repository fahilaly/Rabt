// Travel-time estimate: how long until a driver reaches the hospital.
//
// The prototype uses a built-in estimate (straight-line distance, a road factor and a
// slower speed near the Haram). It runs offline and never calls an outside service.
//
// To use a real maps API later, write a provider with the same shape (see the
// examples at the bottom of this file) and call it from the server, not the browser,
// so the API key stays secret. Cache results per driver for a minute or two so a busy
// ward screen doesn't send a request on every refresh.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Eta {
  minutes: number;
  km: number;
  source: "built-in" | "google" | "osrm";
}

const HARAM: LatLng = { lat: 21.4225, lng: 39.8262 };
const ROAD_FACTOR = 1.4; // roads are longer than a straight line
const HANDOVER_MIN = 4; // parking and walking to the recovery ward

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Built-in estimate. Central Makkah is slow (about 15 km/h in season); outer areas faster.
export function estimate(from: LatLng, to: LatLng): Eta {
  const km = distanceKm(from, to) * ROAD_FACTOR;
  const central = distanceKm(from, HARAM) < 2 || distanceKm(to, HARAM) < 2;
  const kmh = central ? 15 : 28;
  const minutes = Math.max(3, Math.ceil((km / kmh) * 60 + HANDOVER_MIN));
  return { minutes, km: Math.round(km * 10) / 10, source: "built-in" };
}

// Picks the smallest of the driver's arrival-time choices that covers the estimate.
export function suggestChoice(estimateMin: number, choices: number[]): number {
  return choices.find((c) => c >= estimateMin) ?? choices[choices.length - 1];
}

/* ---------------------------------------------------------------------------
   Real providers (not used in the prototype). Run these on the server.

   Google Routes API (traffic-aware, paid per request):

   export async function googleEta(from: LatLng, to: LatLng, key: string): Promise<Eta> {
     const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "X-Goog-Api-Key": key,
         "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
       },
       body: JSON.stringify({
         origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
         destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
         travelMode: "DRIVE",
         routingPreference: "TRAFFIC_AWARE",
       }),
     });
     const r = (await res.json()).routes[0];
     const sec = parseInt(r.duration); // e.g. "754s"
     return { minutes: Math.ceil(sec / 60) + HANDOVER_MIN, km: r.distanceMeters / 1000, source: "google" };
   }

   OSRM (free and open source, no live traffic; self-host it for production):

   export async function osrmEta(from: LatLng, to: LatLng, base = "https://router.project-osrm.org"): Promise<Eta> {
     const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
     const r = (await (await fetch(url)).json()).routes[0];
     return { minutes: Math.ceil(r.duration / 60) + HANDOVER_MIN, km: r.distance / 1000, source: "osrm" };
   }
--------------------------------------------------------------------------- */

// ---------------------------------------------------------------------------
// Optional live travel time from the server function at /api/eta (see api/eta.js).
// Returns null when there is no server, no key or no answer within 2.5 s, and the
// app keeps using the built-in estimate, so the demo never depends on the network.
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; eta: Eta | null }>();
let unavailable = false;

export async function liveEta(from: LatLng, to: LatLng): Promise<Eta | null> {
  if (unavailable || typeof fetch === "undefined" || !/^https?:$/.test(location.protocol)) return null;
  const key = [from.lat, from.lng, to.lat, to.lng].map((x) => x.toFixed(4)).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.eta;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`;
    const res = await fetch(`/api/eta?${q}`, { signal: ctl.signal });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
      unavailable = true; // no server function here (local file, preview): stop asking
      return null;
    }
    const j = await res.json();
    const eta: Eta | null = typeof j.minutes === "number" ? { minutes: j.minutes, km: j.km, source: "google" } : null;
    cache.set(key, { at: Date.now(), eta });
    return eta;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
