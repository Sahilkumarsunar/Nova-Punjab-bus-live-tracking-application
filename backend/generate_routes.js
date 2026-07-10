const fs = require('fs');

const cities = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", 
  "Hoshiarpur", "Mohali", "Batala", "Pathankot", "Moga", 
  "Abohar", "Malerkotla", "Khanna", "Phagwara", "Muktsar", 
  "Barnala", "Rajpura", "Firozpur", "Kapurthala", "Faridkot", 
  "Fazilka", "Gurdaspur", "Kharar", "Mansa", "Sangrur", 
  "Nabha", "Tarn Taran", "Jagraon", "Sunam", "Dhuri", 
  "Sirhind", "Rupnagar", "Nawanshahr", "Zirakpur", "Nakodar", 
  "Kot Kapura", "Patti", "Samana", "Phillaur", "Dasuya",
  "Chandigarh"
];

const CITY_COORDS = {
  "Ludhiana": [30.9010, 75.8573],
  "Amritsar": [31.6340, 74.8723],
  "Chandigarh": [30.7333, 76.7794],
  "Jalandhar": [31.3260, 75.5762],
  "Patiala": [30.3398, 76.3869],
  "Bathinda": [30.2110, 74.9455],
  "Pathankot": [32.2747, 75.6522],
  "Moga": [30.8162, 75.1741],
  "Ferozepur": [30.9337, 74.6136],
  "Firozpur": [30.9337, 74.6136],
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

// Define logical intermediate stops for realistic major corridors
const stopsMap = {
  "Ludhiana-Amritsar": ["Phagwara", "Jalandhar", "Beas"],
  "Chandigarh-Amritsar": ["Mohali", "Rupnagar", "Nawanshahr", "Phagwara", "Jalandhar", "Beas"],
  "Patiala-Jalandhar": ["Sirhind", "Khanna", "Ludhiana", "Phagwara"],
  "Bathinda-Ludhiana": ["Rampura Phul", "Barnala", "Raikot", "Mullanpur"],
  "Pathankot-Jalandhar": ["Dasuya", "Mukerian", "Tanda", "Bhogpur"],
  "Firozpur-Ludhiana": ["Moga", "Jagraon", "Mullanpur"],
  "Hoshiarpur-Chandigarh": ["Mahilpur", "Garhshankar", "Balachaur", "Rupnagar"],
  "Amritsar-Pathankot": ["Batala", "Gurdaspur", "Dinanagar"],
  "Patiala-Bathinda": ["Bhawanigarh", "Sangrur", "Barnala", "Rampura Phul"],
  "Ludhiana-Chandigarh": ["Samrala", "Kharar", "Mohali"],
  "Amritsar-Tarn Taran": ["Jandiala"],
  "Jalandhar-Hoshiarpur": ["Adampur"],
  "Moga-Bathinda": ["Baghapurana", "Kot Kapura", "Goniana"],
  "Firozpur-Bathinda": ["Faridkot", "Kot Kapura"],
  "Abohar-Bathinda": ["Malout", "Giddarbaha"],
  "Pathankot-Hoshiarpur": ["Mukerian", "Dasuya"]
};

function haversineKm([lat1, lon1], [lat2, lon2]) {
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

function getIntermediateStops(source, dest, maxDistKm = 20) {
  const aCoords = CITY_COORDS[source];
  const bCoords = CITY_COORDS[dest];
  if (!aCoords || !bCoords) return [];

  const latA = aCoords[0], lonA = aCoords[1];
  const latB = bCoords[0], lonB = bCoords[1];

  const cosLat = Math.cos(((latA + latB) / 2) * (Math.PI / 180));
  const ax = lonA * cosLat, ay = latA;
  const bx = lonB * cosLat, by = latB;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return [];

  const candidates = [];
  const allPossibleStopCities = Object.keys(CITY_COORDS);

  for (const city of allPossibleStopCities) {
    if (city === source || city === dest) continue;
    const cCoords = CITY_COORDS[city];
    if (!cCoords) continue;

    const px = cCoords[1] * cosLat, py = cCoords[0];
    const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;

    // t is the projection parameter unclamped.
    // It must be strictly between 0.05 and 0.95 to be on the way.
    if (t > 0.05 && t < 0.95) {
      const projLat = ay + t * dy;
      const projLon = (ax + t * dx) / cosLat;
      const dist = haversineKm(cCoords, [projLat, projLon]);
      if (dist <= maxDistKm) {
        candidates.push({ city, t, dist });
      }
    }
  }

  // Sort candidates by perpendicular distance to find the ones closest to the direct path
  candidates.sort((x, y) => x.dist - y.dist);
  
  // Limit to at most 3 stops
  const selected = candidates.slice(0, 3);

  // Sort the selected stops by t (progress along path) so they are in travel sequence
  selected.sort((x, y) => x.t - y.t);

  // Deduplicate by coordinates (just in case there are aliases like Kot Kapura/Kotkapura)
  const result = [];
  const coordsSeen = new Set();
  for (const item of selected) {
    const coords = CITY_COORDS[item.city];
    const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
    if (!coordsSeen.has(key)) {
      coordsSeen.add(key);
      result.push(item.city);
    }
  }

  return result;
}

const routes = [];
const numRoutes = 500;
const generated = new Set();
const dateStr = new Date().toISOString();

while(routes.length < numRoutes) {
  const source = cities[Math.floor(Math.random() * cities.length)];
  const dest = cities[Math.floor(Math.random() * cities.length)];
  
  if (source === dest) continue;
  
  const key1 = `${source}-${dest}`;
  const key2 = `${dest}-${source}`;
  const routeName = `${source} → ${dest}`;
  
  if (generated.has(routeName)) continue;
  generated.add(routeName);
  
  let stops = [];
  if (stopsMap[key1]) {
    stops = [...stopsMap[key1]];
  } else if (stopsMap[key2]) {
    stops = [...stopsMap[key2]].reverse();
  } else {
    // Generate stops that are geometrically on the way
    stops = getIntermediateStops(source, dest, 20);
  }
  
  routes.push({
    routeName: routeName,
    source: source,
    destination: dest,
    stops: stops,
    routeType: "intercity",
    __v: 0,
    createdAt: { "$date": dateStr },
    updatedAt: { "$date": dateStr }
  });
}

// Sort alphabetically for neatness
routes.sort((a, b) => a.routeName.localeCompare(b.routeName));

fs.writeFileSync('punjab_routes.json', JSON.stringify(routes, null, 2));
console.log('Successfully generated 500 routes to punjab_routes.json');
