require("dotenv").config();
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB Atlas connected");
  } catch (e) {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  }
}

module.exports = connectDB;