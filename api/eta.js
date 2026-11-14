// Vercel server function: live travel time from Google Maps (Routes API).
//
// The browser calls /api/eta?from=lat,lng&to=lat,lng. The API key stays here on the
// server, read from the GOOGLE_MAPS_KEY environment variable (Vercel → Settings →
// Environment Variables). Never put the key in the site's code.
//
// No key, a bad request or a Google error → the site falls back to its built-in
// estimate, so the demo keeps working.

const HANDOVER_MIN = 4; // parking and walking to the recovery ward (same as the built-in estimate)

const point = (s) => {
  const [lat, lng] = String(s || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return res.status(501).json({ error: "GOOGLE_MAPS_KEY is not set" });

  const from = point(req.query.from);
  const to = point(req.query.to);
  if (!from || !to) return res.status(400).json({ error: "use ?from=lat,lng&to=lat,lng" });

  try {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
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
    const j = await r.json();
    const route = j.routes && j.routes[0];
    if (!r.ok || !route) return res.status(502).json({ error: "no route from Google" });
    const seconds = parseInt(String(route.duration).replace("s", ""), 10);
    return res.status(200).json({
      minutes: Math.max(3, Math.ceil(seconds / 60) + HANDOVER_MIN),
      km: Math.round((route.distanceMeters / 1000) * 10) / 10,
      source: "google",
    });
  } catch {
    return res.status(502).json({ error: "Google request failed" });
  }
}
