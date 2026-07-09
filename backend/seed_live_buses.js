require("dotenv").config();
const mongoose = require("mongoose");
const Bus = require("./models/Bus");
const Driver = require("./models/Driver");
const Route = require("./models/Route");

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
  "Hoshiarpur": [31.5318, 75.9115],
  "Mansa": [29.9988, 75.3881],
  "Sangrur": [30.2330, 75.8410]
};

const CITIES = Object.keys(CITY_COORDS);

const GOV_BRANDS = ["Punjab Roadways", "PRTC", "PunBus"];
const PRIVATE_BRANDS = ["Private Bus Operator"];

function generateRegNo() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const char1 = letters[Math.floor(Math.random() * letters.length)];
  const char2 = letters[Math.floor(Math.random() * letters.length)];
  const num1 = Math.floor(Math.random() * 90) + 10;
  const num2 = Math.floor(Math.random() * 9000) + 1000;
  return `PB${num1}${char1}${char2}${num2}`; // Generate without hyphens to match client format
}

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  console.log("Connecting to Database...");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  // Fetch routes seeded by user's npm run seed
  let routes = await Route.find();
  if (routes.length === 0) {
    console.log("No routes found, creating fallback routes...");
    const sampleRoutes = [
      { routeName: "Ludhiana → Amritsar", source: "Ludhiana", destination: "Amritsar", stops: ["Jalandhar", "Beas"] },
      { routeName: "Chandigarh → Amritsar", source: "Chandigarh", destination: "Amritsar", stops: ["Rupnagar", "Jalandhar"] },
      { routeName: "Patiala → Bathinda", source: "Patiala", destination: "Bathinda", stops: ["Sangrur", "Barnala"] },
      { routeName: "Amritsar → Pathankot", source: "Amritsar", destination: "Pathankot", stops: ["Batala", "Gurdaspur"] },
      { routeName: "Ludhiana → Chandigarh", source: "Ludhiana", destination: "Chandigarh", stops: ["Kharar", "Mohali"] }
    ];
    routes = await Route.insertMany(sampleRoutes);
    console.log(`Created ${routes.length} fallback routes.`);
  } else {
    console.log(`Found ${routes.length} existing routes. Linking new buses to these routes.`);
  }

  console.log("Generating 60 dummy drivers...");
  const driversToInsert = [];
  const startPhone = 9000000000 + Math.floor(Math.random() * 10000000);
  for (let i = 0; i < 60; i++) {
    const serial = String(i).padStart(7, "0");
    driversToInsert.push({
      name: `Dummy Driver ${i + 1}`,
      phone: String(startPhone + i),
      dlNumber: `PB102020${serial}`,
      password: "password123"
    });
  }

  // Remove previous dummy drivers to avoid duplication error on unique phone index
  await Driver.deleteMany({ name: /^Dummy Driver/ });
  const createdDrivers = await Driver.insertMany(driversToInsert);
  console.log(`Created ${createdDrivers.length} dummy drivers.`);

  console.log("Generating 60 buses with mixed statuses...");
  const busesToInsert = [];
  for (let i = 0; i < 60; i++) {
    const isGov = Math.random() > 0.3;
    const brand = isGov 
      ? GOV_BRANDS[Math.floor(Math.random() * GOV_BRANDS.length)]
      : PRIVATE_BRANDS[0];
    const type = isGov ? "government" : "private";

    const route = routes[Math.floor(Math.random() * routes.length)];
    const driver = createdDrivers[i];

    // Pick a random city to center the bus location around
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const center = CITY_COORDS[city];
    
    // Add offset of up to ~25km (0.25 degrees) to scatter them logically
    const latOffset = (Math.random() - 0.5) * 0.4;
    const lngOffset = (Math.random() - 0.5) * 0.4;
    const latitude = center[0] + latOffset;
    const longitude = center[1] + lngOffset;

    // Distribute availability statuses:
    // - 15 Running (lastUpdated: now)
    // - 25 Offline (lastUpdated: 15 mins ago today)
    // - 20 Inactive (lastUpdated: 30 hours ago yesterday)
    let lastUpdatedDate;
    let tripStarted = false;

    if (i < 15) {
      // 15 Running / Active
      lastUpdatedDate = new Date(); // now
      tripStarted = true;
    } else if (i < 40) {
      // 25 Offline (Operated today but stale)
      lastUpdatedDate = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago
      tripStarted = true;
    } else {
      // 20 Inactive (Yesterday)
      lastUpdatedDate = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
      tripStarted = false;
    }

    busesToInsert.push({
      busNumber: generateRegNo(),
      busBrand: brand,
      busType: type,
      driverId: driver._id,
      routeId: route._id,
      status: i < 15 ? "active" : "offline", // legacy status alignment
      tripStarted: tripStarted,
      currentLocation: {
        latitude: latitude,
        longitude: longitude,
        heading: Math.floor(Math.random() * 360),
        speed: (Math.random() * 15 + 10),
        lastUpdated: lastUpdatedDate
      }
    });
  }

  // Remove previous dummy buses (both hyphenated and non-hyphenated) to keep DB clean
  await Bus.deleteMany({ busNumber: /^PB-?\d{2}[A-Z]{2}-?\d{4}$/ });
  const createdBuses = await Bus.insertMany(busesToInsert);
  console.log(`Successfully seeded ${createdBuses.length} buses: 15 running, 25 offline, 20 inactive.`);

  // Link driver assignedBusId
  for (let i = 0; i < 60; i++) {
    await Driver.findByIdAndUpdate(createdDrivers[i]._id, { assignedBusId: createdBuses[i]._id });
  }
  console.log("Linked driver profiles with assigned buses.");

  await mongoose.disconnect();
  console.log("Disconnected from database. Seeding done!");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
