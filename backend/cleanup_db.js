require("dotenv").config();
const mongoose = require("mongoose");
const Bus = require("./models/Bus");

async function cleanup() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const buses = await Bus.find({});
  console.log(`Checking ${buses.length} buses...`);
  
  let deletedCount = 0;
  const validRegNoRegex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;

  for (const bus of buses) {
    const cleaned = bus.busNumber.replace(/[\s-]/g, "").toUpperCase();
    if (!validRegNoRegex.test(cleaned)) {
      console.log(`Deleting invalid bus: ${bus.busNumber} (ID: ${bus._id})`);
      await Bus.deleteOne({ _id: bus._id });
      deletedCount++;
    }
  }

  console.log(`Cleanup finished. Deleted ${deletedCount} invalid buses.`);
  process.exit(0);
}
cleanup();
