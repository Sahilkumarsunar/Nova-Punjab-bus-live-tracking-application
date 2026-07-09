require("dotenv").config();
const mongoose = require("mongoose");
const Bus = require("./models/Bus");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const buses = await Bus.find({}, "busNumber availabilityStatus");
  console.log("Registered Bus Numbers:");
  console.log(JSON.stringify(buses, null, 2));
  process.exit(0);
}
check();
