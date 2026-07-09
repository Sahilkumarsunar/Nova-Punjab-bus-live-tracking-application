import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { startTrip as apiStartTrip, stopTrip as apiStopTrip } from "./api";
import { LOCATION_TASK_NAME } from "./locationTask";

// ─── Singleton in-memory state ─────────────────────────────────────────────
// Lives for the entire JS process lifetime → survives screen navigation.
let _state = { running: false, busId: null, sendCount: 0 };
const _listeners = new Set();

function setState(patch) {
  _state = { ..._state, ...patch };
  _listeners.forEach((fn) => fn(_state));
}

export function getState() {
  return _state;
}

// Subscribe to state changes. Returns an unsubscribe function.
export function subscribe(fn) {
  _listeners.add(fn);
  fn(_state); // emit current state immediately on subscribe
  return () => _listeners.delete(fn);
}

// ─── Poll AsyncStorage for sendCount coming from background task ────────────
// Background tasks cannot write directly to React state, so they write to
// AsyncStorage. This poller reads it every 3 s and syncs to in-memory state.
let _pollTimer = null;
export function startSendCountPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    if (!_state.running) return;
    const cnt = parseInt(
      (await AsyncStorage.getItem("nova_send_count")) || "0",
      10
    );
    if (cnt !== _state.sendCount) setState({ sendCount: cnt });
  }, 3000);
}

// ─── Start trip ─────────────────────────────────────────────────────────────
export async function startTrip(busId) {
  // Ask for background location (Expo Go supports this on Android)
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    // Fall back: at minimum need foreground
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted")
      throw new Error("Location permission is required to start the trip.");
  }

  // Tell backend the trip has started
  await apiStartTrip(busId);

  // Persist busId so the background task can read it
  await AsyncStorage.setItem("nova_active_bus_id", busId);
  await AsyncStorage.setItem("nova_send_count", "0");

  // Start OS-level background location updates
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  ).catch(() => false);

  if (!alreadyRunning) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 10000,          // every 10 seconds
      distanceInterval: 0,          // time-based, not distance
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        // Android: keeps a persistent notification so the OS won't kill the task
        notificationTitle: "NOVA — Trip Active",
        notificationBody: "Sharing your location with passengers every 10 s",
        notificationColor: "#7B2CBF",
      },
    });
  }

  setState({ running: true, busId, sendCount: 0 });
  startSendCountPolling();
}

// ─── Stop trip ──────────────────────────────────────────────────────────────
export async function stopTrip() {
  const { busId } = _state;

  // Tell backend the trip ended
  try {
    if (busId) await apiStopTrip(busId);
  } catch (e) {
    console.warn("[NOVA] stopTrip API error:", e.message);
  }

  // Stop background location task
  const isRunning = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  ).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

  // Clear poll timer
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }

  // Clear persisted state
  await AsyncStorage.multiRemove(["nova_active_bus_id", "nova_send_count"]);

  setState({ running: false, busId: null, sendCount: 0 });
}
