const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    dlNumber: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    assignedBusId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = mongoose.model("Driver", driverSchema);
