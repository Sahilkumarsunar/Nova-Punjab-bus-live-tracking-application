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

const routes = [];
const numRoutes = 200;
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
    // If no hardcoded map, generate 1-3 random logical stops to simulate
    const numStops = Math.floor(Math.random() * 3); // 0 to 2 stops
    const available = cities.filter(c => c !== source && c !== dest);
    for(let i=0; i<numStops; i++) {
      const stop = available[Math.floor(Math.random() * available.length)];
      if (!stops.includes(stop)) stops.push(stop);
    }
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
console.log('Successfully generated 200 routes to punjab_routes.json');
