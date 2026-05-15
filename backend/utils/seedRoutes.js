require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Route = require("../models/Route");

const ROUTES = [
  ["Ludhiana", "Amritsar", ["Jalandhar", "Beas"]],
  ["Ludhiana", "Chandigarh", ["Khanna", "Rajpura"]],
  ["Jalandhar", "Chandigarh", ["Phagwara", "Ludhiana", "Khanna", "Rajpura"]],
  ["Amritsar", "Pathankot", ["Batala", "Gurdaspur"]],
  ["Jalandhar", "Patiala", ["Ludhiana", "Khanna"]],
  ["Patiala", "Bathinda", ["Sangrur", "Barnala"]],
  ["Bathinda", "Mansa", ["Maur", "Budhlada"]],
  ["Moga", "Ferozepur", ["Zira"]],
  ["Ludhiana", "Moga", ["Jagraon"]],
  ["Jalandhar", "Hoshiarpur", ["Adampur"]],
  ["Hoshiarpur", "Pathankot", ["Mukerian", "Dasuya"]],
  ["Patiala", "Ludhiana", ["Sirhind", "Khanna"]],
  ["Amritsar", "Tarn Taran", ["Chabal"]],
  ["Tarn Taran", "Ferozepur", ["Makhu"]],
  ["Bathinda", "Faridkot", ["Kotkapura"]],
  ["Faridkot", "Ferozepur", ["Zira"]],
  ["Mansa", "Sangrur", ["Bhikhi"]],
  ["Sangrur", "Barnala", ["Mehal Kalan"]],
  ["Barnala", "Ludhiana", ["Raikot"]],
  ["Pathankot", "Gurdaspur", ["Dinanagar"]],
  ["Jalandhar", "Kapurthala", ["Kartarpur"]],
];

(async () => {
  await connectDB();
  await Route.deleteMany({});
  const docs = ROUTES.map(([source, destination, stops]) => ({
    routeName: `${source} → ${destination}`,
    source,
    destination,
    stops,
    routeType: "intercity",
  }));
  await Route.insertMany(docs);
  console.log(`Seeded ${docs.length} routes`);
  await mongoose.disconnect();
  process.exit(0);
})();
