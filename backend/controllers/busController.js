const Bus = require("../models/Bus");
const Driver = require("../models/Driver");
const Route = require("../models/Route");
const { computeStatus } = require("../utils/offline");
const PickupRequest = require("../models/PickupRequest");
const { CITY_COORDS, haversineKm, projectOnSegment } = require("../utils/coords");

exports.registerBus = async (req, res) => {
  try {
    const { busNumber, busBrand, busType, routeId } = req.body;
    if (!busNumber || !busBrand || !busType || !routeId)
      return res.status(400).json({ message: "All bus fields required" });

    const cleanBusNumber = busNumber.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(cleanBusNumber)) {
      return res.status(400).json({ message: "Invalid Bus registration number format (e.g. PB10AB1234)" });
    }

    const route = await Route.findById(routeId);
    if (!route) return res.status(400).json({ message: "Invalid route" });

    let bus = await Bus.findOne({ driverId: req.driverId });
    if (bus) {
      bus.busNumber = cleanBusNumber;
      bus.busBrand = busBrand;
      bus.busType = busType;
      bus.routeId = routeId;
      await bus.save();
    } else {
      const dupe = await Bus.findOne({ busNumber: cleanBusNumber });
      if (dupe) return res.status(409).json({ message: "Bus number already exists" });

      bus = await Bus.create({
        busNumber: cleanBusNumber,
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
  const { latitude, longitude, heading, speed, timestamp } = req.body;
  if (typeof latitude !== "number" || typeof longitude !== "number")
    return res.status(400).json({ message: "latitude & longitude required (numbers)" });

  const locationUpdate = {
    latitude,
    longitude,
    lastUpdated: timestamp ? new Date(timestamp) : new Date()
  };
  if (typeof heading === "number") locationUpdate.heading = heading;
  if (typeof speed === "number") locationUpdate.speed = speed;

  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    { currentLocation: locationUpdate },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });

  // ─── Automatic Behaviour: Check if bus passed any stops with active requests ───
  try {
    const route = await Route.findById(bus.routeId);
    if (route) {
      const waypoints = [];
      const srcCoord = CITY_COORDS[route.source];
      if (srcCoord) waypoints.push({ name: route.source, coord: srcCoord });
      if (route.stops) {
        for (const stop of route.stops) {
          const coord = CITY_COORDS[stop];
          if (coord) waypoints.push({ name: stop, coord });
        }
      }
      const dstCoord = CITY_COORDS[route.destination];
      if (dstCoord) waypoints.push({ name: route.destination, coord: dstCoord });

      if (waypoints.length > 0) {
        const busPos = [latitude, longitude];
        let minPerpDist = Infinity;
        let activeSegIdx = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
          const { projLat, projLon } = projectOnSegment(
            busPos,
            waypoints[i].coord,
            waypoints[i + 1].coord
          );
          const dist = haversineKm(busPos, [projLat, projLon]);
          if (dist < minPerpDist) {
            minPerpDist = dist;
            activeSegIdx = i;
          }
        }

        const distToStart = haversineKm(busPos, waypoints[activeSegIdx].coord);
        const distToEnd = haversineKm(busPos, waypoints[activeSegIdx + 1].coord);

        let currentStopIdx = activeSegIdx + 1;
        if (distToStart < 1.5) {
          currentStopIdx = activeSegIdx;
        } else if (distToEnd < 1.5) {
          currentStopIdx = activeSegIdx + 1;
        }

        // Stops with index < currentStopIdx are passed!
        const passedStopNames = waypoints
          .slice(0, currentStopIdx)
          .map(wp => wp.name);

        if (passedStopNames.length > 0) {
          // Find all active requests for this bus at these passed stops
          const reqsToPass = await PickupRequest.find({
            busId: bus._id,
            stopName: { $in: passedStopNames },
            status: { $in: ["sent", "accepted", "approaching", "arrived"] }
          });

          if (reqsToPass.length > 0) {
            for (const r of reqsToPass) {
              r.status = "passed";
              await r.save();
              if (req.io) {
                req.io.emit("pickupRequestUpdate", { busId: bus._id.toString(), request: r });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error auto-passing pickup requests:", err);
  }

  // Derive availability status from the fresh timestamp before broadcasting
  const computed = computeStatus(bus);

  if (req.io) {
    req.io.emit("busLocationUpdate", computed);
  }

  res.json(computed);
};

exports.startTrip = async (req, res) => {
  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    { tripStarted: true },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });

  const computed = computeStatus(bus);

  if (req.io) {
    req.io.emit("busLocationUpdate", computed);
  }

  res.json(computed);
};

exports.stopTrip = async (req, res) => {
  const bus = await Bus.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driverId },
    { tripStarted: false },
    { new: true }
  );
  if (!bus) return res.status(404).json({ message: "Bus not found" });

  // After trip stops, lastUpdated stays from the last ping — status will
  // naturally degrade to "offline" once LIVE_THRESHOLD_MS passes.
  const computed = computeStatus(bus);

  if (req.io) {
    req.io.emit("busLocationUpdate", computed);
  }

  res.json(computed);
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

// ── Smart Pickup Request System Controller Functions ──

exports.createPickupRequest = async (req, res) => {
  try {
    const { passengerId, stopName } = req.body;
    if (!passengerId || !stopName) {
      return res.status(400).json({ message: "passengerId and stopName are required" });
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });

    if (!bus.acceptingRequests || bus.isFull) {
      return res.status(400).json({ message: "Bus is full or temporarily not accepting requests" });
    }

    const route = await Route.findById(bus.routeId);
    if (!route) return res.status(404).json({ message: "Route not found for this bus" });

    const allStops = [route.source, ...(route.stops || []), route.destination];
    if (!allStops.includes(stopName)) {
      return res.status(400).json({ message: "The selected stop is not on this bus's route" });
    }

    // Check duplicate active request
    const existing = await PickupRequest.findOne({
      passengerId,
      busId: bus._id,
      status: { $in: ["sent", "accepted", "approaching", "arrived"] }
    });
    if (existing) {
      return res.status(400).json({ message: "You already have an active pickup request for this bus" });
    }

    const request = await PickupRequest.create({
      passengerId,
      busId: bus._id,
      routeId: bus.routeId,
      stopName,
      status: "sent"
    });

    if (req.io) {
      req.io.emit("pickupRequestUpdate", { busId: bus._id.toString(), request });
    }

    res.status(201).json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.cancelPickupRequest = async (req, res) => {
  try {
    const { passengerId } = req.body;
    if (!passengerId) {
      return res.status(400).json({ message: "passengerId is required" });
    }

    const request = await PickupRequest.findOneAndUpdate(
      {
        passengerId,
        busId: req.params.id,
        status: { $in: ["sent", "accepted", "approaching", "arrived"] }
      },
      { status: "cancelled" },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "No active pickup request found for this bus" });
    }

    if (req.io) {
      req.io.emit("pickupRequestUpdate", { busId: req.params.id, request });
    }

    res.json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getActivePickupRequest = async (req, res) => {
  try {
    const { passengerId } = req.query;
    if (!passengerId) {
      return res.status(400).json({ message: "passengerId is required" });
    }

    const request = await PickupRequest.findOne({
      passengerId,
      busId: req.params.id,
      status: { $in: ["sent", "accepted", "approaching", "arrived"] }
    });

    res.json(request || null);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.listPickupRequests = async (req, res) => {
  try {
    const requests = await PickupRequest.find({
      busId: req.params.id,
      status: { $in: ["sent", "accepted", "approaching", "arrived"] }
    });
    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updatePickupRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const bus = await Bus.findOne({ _id: req.params.id, driverId: req.driverId });
    if (!bus) {
      return res.status(403).json({ message: "Not authorized to update this bus" });
    }

    const request = await PickupRequest.findOneAndUpdate(
      { _id: req.params.requestId, busId: bus._id },
      { status },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "Pickup request not found" });
    }

    if (req.io) {
      req.io.emit("pickupRequestUpdate", { busId: bus._id.toString(), request });
    }

    res.json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateTripSettings = async (req, res) => {
  try {
    const { acceptingRequests, isFull, occupancy } = req.body;

    const bus = await Bus.findOne({ _id: req.params.id, driverId: req.driverId });
    if (!bus) {
      return res.status(403).json({ message: "Not authorized to update this bus" });
    }

    if (acceptingRequests !== undefined) bus.acceptingRequests = acceptingRequests;
    if (isFull !== undefined) bus.isFull = isFull;
    if (occupancy !== undefined) bus.occupancy = occupancy;

    await bus.save();

    const computed = computeStatus(bus);

    if (req.io) {
      req.io.emit("busLocationUpdate", computed);
      req.io.emit("busSettingsUpdate", computed);
    }

    res.json(computed);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
