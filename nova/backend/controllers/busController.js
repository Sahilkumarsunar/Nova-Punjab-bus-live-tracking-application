const Bus = require("../models/Bus");
const Driver = require("../models/Driver");
const Route = require("../models/Route");
const { computeStatus } = require("../utils/offline");

exports.registerBus = async (req, res) => {
  try {
    const { busNumber, busBrand, busType, routeId } = req.body;
    if (!busNumber || !busBrand || !busType || !routeId)
      return res.status(400).json({ message: "All bus fields required" });

    const route = await Route.findById(routeId);
    if (!route) return res.status(400).json({ message: "Invalid route" });

    let bus = await Bus.findOne({ driverId: req.driverId });
    if (bus) {
      bus.busNumber = busNumber.toUpperCase();
      bus.busBrand = busBrand;
      bus.busType = busType;
      bus.routeId = routeId;
      await bus.save();
    } else {
      const dupe = await Bus.findOne({ busNumber: busNumber.toUpperCase() });
      if (dupe) return res.status(409).json({ message: "Bus number already exists" });

      bus = await Bus.create({
        busNumber: busNumber.toUpperCase(),
        busBrand,
        busType,
        routeId,
        driverId: req.driverId,
      });
      await Driver.findByIdAndUpdate(req.driverId, { assignedBusId: bus._id });
    }

    res.status(201).json(bus);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateBus = async (req, res) => {
  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    req.body,
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  res.json(bus);
};

exports.updateLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  if (typeof latitude !== "number" || typeof longitude !== "number")
    return res.status(400).json({ message: "latitude & longitude required (numbers)" });

  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    {
      currentLocation: { latitude, longitude, lastUpdated: new Date() },
      status: "active",
    },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  res.json(bus);
};

exports.startTrip = async (req, res) => {
  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    { tripStarted: true, status: "active" },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  res.json(bus);
};

exports.stopTrip = async (req, res) => {
  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    { tripStarted: false, status: "offline" },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  res.json(bus);
};

exports.listBuses = async (_req, res) => {
  const buses = await Bus.find()
    .populate("routeId")
    .populate("driverId", "name phone");
  res.json(buses.map(computeStatus));
};

exports.getBus = async (req, res) => {
  const bus = await Bus.findById(req.params.id)
    .populate("routeId")
    .populate("driverId", "name phone");
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  res.json(computeStatus(bus));
};

exports.busesByRoute = async (req, res) => {
  const buses = await Bus.find({ routeId: req.params.routeId })
    .populate("routeId")
    .populate("driverId", "name phone");
  res.json(buses.map(computeStatus));
};

exports.myBus = async (req, res) => {
  const bus = await Bus.findOne({ driverId: req.driverId }).populate("routeId");
  res.json(bus || null);
};
