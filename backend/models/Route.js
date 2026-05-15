const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
  {
    routeName: { type: String, required: true },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    stops: [{ type: String }],
    routeType: { type: String, default: "intercity" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Route", routeSchema);
