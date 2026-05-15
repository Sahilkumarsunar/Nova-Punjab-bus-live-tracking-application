const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

function computeStatus(bus) {
  if (!bus) return bus;
  const obj = bus.toObject ? bus.toObject() : bus;
  const last = obj.currentLocation?.lastUpdated
    ? new Date(obj.currentLocation.lastUpdated).getTime()
    : 0;
  const isFresh = last && Date.now() - last < OFFLINE_THRESHOLD_MS;
  obj.status = obj.tripStarted && isFresh ? "active" : "offline";
  return obj;
}

module.exports = { computeStatus, OFFLINE_THRESHOLD_MS };
