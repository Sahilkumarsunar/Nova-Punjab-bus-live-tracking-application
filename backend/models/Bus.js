const mongoose = require("mongoose");

const GOV_BRANDS = ["Punjab Roadways", "PRTC", "PunBus"];
const PRIVATE_BRANDS = ["Private Bus Operator"];

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    busBrand: {
      type: String,
      required: true,
      enum: [...GOV_BRANDS, ...PRIVATE_BRANDS],
    },
    busType: { type: String, required: true, enum: ["government", "private"] },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
    status: { type: String, enum: ["active", "offline"], default: "offline" },
    tripStarted: { type: Boolean, default: false },
    capacity: { type: Number, default: 40 },
    occupancy: { type: Number, default: 0 },
    isFull: { type: Boolean, default: false },
    acceptingRequests: { type: Boolean, default: true },
    currentLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      heading: { type: Number, default: null }, // compass bearing 0-360
      speed: { type: Number, default: null },
      lastUpdated: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);
module.exports.GOV_BRANDS = GOV_BRANDS;
module.exports.PRIVATE_BRANDS = PRIVATE_BRANDS;
