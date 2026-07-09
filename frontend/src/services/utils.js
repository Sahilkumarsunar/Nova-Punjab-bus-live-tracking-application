/**
 * How fresh a GPS update must be to count as "running".
 * Must match LIVE_THRESHOLD_MS in backend/utils/offline.js.
 */
export const LIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Derive the three-state availability for a bus from its lastUpdated timestamp.
 *
 * Returns one of:
 *  "running"  — GPS ping received within LIVE_THRESHOLD_MS. Green, clickable.
 *  "offline"  — GPS ping received today but stale. Orange, still clickable.
 *  "inactive" — No GPS ping today (or ever). Greyscale, disabled.
 *
 * This mirrors the logic in backend/utils/offline.js so socket-delivered bus
 * objects can have their status re-computed on the client without an API call.
 *
 * @param {object} bus - bus object from API or socket event
 * @returns {"running"|"offline"|"inactive"}
 */
export function getAvailabilityStatus(bus) {
  const rawLastUpdated = bus?.currentLocation?.lastUpdated;
  if (!rawLastUpdated) return "inactive";

  const lastUpdated = new Date(rawLastUpdated);
  if (isNaN(lastUpdated.getTime())) return "inactive";

  const ageMs = Date.now() - lastUpdated.getTime();

  if (ageMs <= LIVE_THRESHOLD_MS) return "running";

  // Check if lastUpdated is today (client local time)
  const now = new Date();
  const isToday =
    lastUpdated.getFullYear() === now.getFullYear() &&
    lastUpdated.getMonth()    === now.getMonth()    &&
    lastUpdated.getDate()     === now.getDate();

  return isToday ? "offline" : "inactive";
}

export const CITY_COORDS = {
  "Ludhiana": [30.9010, 75.8573],
  "Amritsar": [31.6340, 74.8723],
  "Chandigarh": [30.7333, 76.7794],
  "Jalandhar": [31.3260, 75.5762],
  "Patiala": [30.3398, 76.3869],
  "Bathinda": [30.2110, 74.9455],
  "Pathankot": [32.2747, 75.6522],
  "Moga": [30.8162, 75.1741],
  "Ferozepur": [30.9337, 74.6136],
  "Hoshiarpur": [31.5318, 75.9115],
  "Mansa": [29.9988, 75.3881],
  "Sangrur": [30.2330, 75.8410],
  "Barnala": [30.3819, 75.5482],
  "Faridkot": [30.6770, 74.7583],
  "Tarn Taran": [31.4524, 74.9275],
  "Gurdaspur": [32.0414, 75.4035],
  "Kapurthala": [31.3796, 75.3809],
  "Khanna": [30.6976, 76.2174],
  "Rajpura": [30.4838, 76.5927],
  "Beas": [31.5133, 75.1707],
  "Phagwara": [31.2240, 75.7708],
  "Batala": [31.8180, 75.2035],
  "Maur": [30.0808, 75.2264],
  "Budhlada": [29.9274, 75.5592],
  "Zira": [30.9680, 74.9928],
  "Jagraon": [30.7897, 75.4705],
  "Adampur": [31.4320, 75.7163],
  "Mukerian": [31.9520, 75.6165],
  "Dasuya": [31.8170, 75.6530],
  "Sirhind": [30.6453, 76.3896],
  "Chabal": [31.5498, 74.8820],
  "Makhu": [31.1045, 74.9998],
  "Kotkapura": [30.5850, 74.8178],
  "Kot Kapura": [30.5850, 74.8178],
  "Bhikhi": [30.0488, 75.5350],
  "Mehal Kalan": [30.3290, 75.6630],
  "Raikot": [30.6520, 75.6070],
  "Dinanagar": [32.1392, 75.4678],
  "Kartarpur": [31.4440, 75.5006],
  "Mohali": [30.7046, 76.7179],
  "Abohar": [30.1453, 74.1993],
  "Malerkotla": [30.5225, 75.8828],
  "Muktsar": [30.4816, 74.5209],
  "Fazilka": [30.4031, 74.0253],
  "Kharar": [30.7431, 76.6457],
  "Nabha": [30.3734, 76.1477],
  "Sunam": [30.1345, 75.8010],
  "Dhuri": [30.3700, 75.8700],
  "Rupnagar": [30.9664, 76.5331],
  "Nawanshahr": [31.1256, 76.1158],
  "Zirakpur": [30.6424, 76.8173],
  "Nakodar": [31.1278, 75.4745],
  "Patti": [31.2828, 74.8622],
  "Samana": [30.1582, 76.1923],
  "Phillaur": [31.0258, 75.7865],
  "Rampura Phul": [30.2721, 75.2415],
  "Samrala": [30.8359, 76.1855],
  "Jandiala": [31.5540, 75.0210],
  "Goniana": [30.3168, 74.9080],
  "Mullanpur": [30.8267, 75.6321],
  "Baghapurana": [30.5898, 75.0841],
  "Malout": [30.1982, 74.4952],
  "Giddarbaha": [30.1983, 74.6548],
  "Mahilpur": [31.3541, 76.0526],
  "Garhshankar": [31.2131, 76.1450],
  "Balachaur": [31.0505, 76.3072],
  "Bhawanigarh": [30.2644, 76.0425],
  "Tanda": [31.6705, 75.6397],
  "Bhogpur": [31.5458, 75.6416]
};

// Haversine formula — straight-line distance in km between two [lat, lng] points
export function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate and format ETA
export function formatETA(distanceKm, speedMps, baseDate = new Date()) {
  if (distanceKm < 0.15) {
    return "Reached";
  }

  // If speed is not a valid number or under 2 m/s (7.2 km/h), use 40 km/h as fallback
  let speedKmh = 40;
  if (typeof speedMps === "number" && speedMps >= 2) {
    speedKmh = speedMps * 3.6;
  }

  const timeHours = distanceKm / speedKmh;
  const timeMinutes = Math.max(1, Math.round(timeHours * 60));

  const targetTime = new Date(baseDate.getTime() + timeMinutes * 60 * 1000);
  const formattedTime = targetTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let durationStr = `${timeMinutes} min`;
  if (timeMinutes > 59) {
    const h = Math.floor(timeMinutes / 60);
    const m = timeMinutes % 60;
    durationStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return `${formattedTime} (${durationStr})`;
}

// Project point P onto segment AB using equirectangular approximation.
// Returns { t ∈ [0,1] } — how far along AB the foot of the perpendicular is,
// plus the projected [lat, lon] so we can measure perpendicular distance.
export function projectOnSegment([pLat, pLon], [aLat, aLon], [bLat, bLon]) {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const ax = aLon * cosLat, ay = aLat;
  const bx = bLon * cosLat, by = bLat;
  const px = pLon * cosLat, py = pLat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, projLat: aLat, projLon: aLon };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { t, projLat: ay + t * dy, projLon: (ax + t * dx) / cosLat };
}
