const mongoose = require("mongoose");

const pickupRequestSchema = new mongoose.Schema(
  {
    passengerId: { type: String, required: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
    stopName: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    status: {
      type: String,
      enum: [
        "sent",
        "accepted",
        "rejected",
        "approaching",
        "arrived",
        "completed",
        "full",
        "passed",
        "cancelled"
      ],
      default: "sent"
    }
  },
  { timestamps: true }
);

// Compound index to prevent duplicate active requests from same passenger on same bus
pickupRequestSchema.index({ passengerId: 1, busId: 1, status: 1 });

module.exports = mongoose.model("PickupRequest", pickupRequestSchema);
