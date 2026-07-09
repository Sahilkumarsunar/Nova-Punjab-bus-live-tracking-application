require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Route = require("../models/Route");
const punjabRoutes = require("../punjab_routes.json");

(async () => {
  await connectDB();
  await Route.deleteMany({});
  
  // Clean up the `_id`, `__v`, `createdAt`, and `updatedAt` if they exist 
  // so Mongoose handles them properly on insertion
  const docs = punjabRoutes.map(route => ({
    routeName: route.routeName,
    source: route.source,
    destination: route.destination,
    stops: route.stops,
    routeType: route.routeType,
  }));
  
  await Route.insertMany(docs);
  console.log(`Seeded ${docs.length} routes`);
  await mongoose.disconnect();
  process.exit(0);
})();
