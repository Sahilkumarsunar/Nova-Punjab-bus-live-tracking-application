import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateLocation } from "./api";

export const LOCATION_TASK_NAME = "nova-background-location";

// ─── MUST be defined at module top-level (not inside any function/component) ──
// The OS wakes the JS runtime and runs this task even when the app is killed.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[NOVA] Background location error:", error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const loc = data.locations[0];
  const { latitude, longitude, heading, speed } = loc.coords;
  const timestamp = loc.timestamp;
  const busId = await AsyncStorage.getItem("nova_active_bus_id");
  if (!busId) return;

  try {
    // heading is 0-360 compass bearing; -1 means not available
    const validHeading = typeof heading === "number" && heading >= 0 ? heading : null;
    const validSpeed = typeof speed === "number" && speed >= 0 ? speed : null;
    await updateLocation(busId, latitude, longitude, validHeading, validSpeed, timestamp);

    // Increment counter so the UI can read it via polling
    const prev = parseInt(
      (await AsyncStorage.getItem("nova_send_count")) || "0",
      10
    );
    await AsyncStorage.setItem("nova_send_count", String(prev + 1));

    console.log(
      "[NOVA] Ping sent:",
      loc.coords.latitude.toFixed(5),
      loc.coords.longitude.toFixed(5)
    );
  } catch (e) {
    console.warn("[NOVA] Failed to send location:", e.message);
  }
});
