/**
 * Bus Availability Status Utility
 *
 * Determines one of three availability states for a bus based solely on
 * the timestamp of its last GPS location update — no manual triggers needed.
 *
 * States:
 *  "running"   — Last update is recent (within LIVE_THRESHOLD_MS). Bus is
 *                actively sending GPS pings. Show in green, fully clickable.
 *
 *  "offline"   — Last update was received TODAY but is now stale (older than
 *                LIVE_THRESHOLD_MS). The driver may have finished the trip or
 *                the app went temporarily offline. Show in orange/gray, still
 *                clickable (last-known location available).
 *
 *  "inactive"  — No location update received today at all (last update is
 *                from yesterday or earlier, or never). Bus has not operated
 *                today. Show greyscale, disabled, not clickable.
 *
 * After midnight, all buses automatically become "inactive" until their first
 * GPS ping of the new day arrives, at which point they transition to "running".
 */

/** How fresh a location update must be to count as "running" (2 minutes) */
const LIVE_THRESHOLD_MS = 2 * 60 * 1000;

/** Legacy alias used in older parts of the codebase */
const OFFLINE_THRESHOLD_MS = LIVE_THRESHOLD_MS;

/**
 * Returns whether a Date object falls on the same calendar day as "now"
 * in the server's local timezone.
 *
 * @param {Date} date
 * @returns {boolean}
 */
function isToday(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth()    &&
    date.getDate()     === now.getDate()
  );
}

/**
 * Derive the three-state availability status from a bus document.
 * Works with both Mongoose documents (with .toObject()) and plain objects.
 *
 * @param {object} bus - Mongoose bus document or plain bus object
 * @returns {object} Plain object with `availabilityStatus` (and legacy `status`) set
 */
function computeStatus(bus) {
  if (!bus) return bus;

  const obj = bus.toObject ? bus.toObject() : { ...bus };

  const rawLastUpdated = obj.currentLocation?.lastUpdated;
  const lastUpdated = rawLastUpdated ? new Date(rawLastUpdated) : null;

  let availabilityStatus;

  if (!lastUpdated || isNaN(lastUpdated.getTime())) {
    // No GPS update ever received
    availabilityStatus = "inactive";
  } else {
    const ageMs = Date.now() - lastUpdated.getTime();

    if (ageMs <= LIVE_THRESHOLD_MS) {
      // Recent update → actively running
      availabilityStatus = "running";
    } else if (isToday(lastUpdated)) {
      // Update received today but stale → operated today, currently offline
      availabilityStatus = "offline";
    } else {
      // Last update was yesterday or earlier → not operated today
      availabilityStatus = "inactive";
    }
  }

  obj.availabilityStatus = availabilityStatus;

  // Keep legacy `status` field in sync for backwards compatibility with older
  // frontend components that read bus.status === "active" / "offline"
  obj.status = availabilityStatus === "running" ? "active" : "offline";

  return obj;
}

module.exports = { computeStatus, LIVE_THRESHOLD_MS, OFFLINE_THRESHOLD_MS };
