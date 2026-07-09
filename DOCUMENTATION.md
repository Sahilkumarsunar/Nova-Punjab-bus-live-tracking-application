# NOVA — Project Documentation
### Punjab Bus Live Tracking Application

> Written in simple language for interview preparation and project understanding.

---

## 1. What is NOVA?

NOVA is a **full-stack MERN application** that lets passengers track Punjab government and private buses in real time on a map. Drivers use a mobile app to share their GPS location every 10 seconds, and passengers see the bus moving live on a website.

**The 3 parts:**
| Part | Tech | Who uses it |
|---|---|---|
| Backend (API Server) | Node.js + Express + MongoDB | Both apps talk to this |
| Frontend (Website) | React + Vite + Leaflet Maps | Passengers |
| Mobile App | React Native + Expo | Bus Drivers |

---

## 2. Tech Stack Breakdown

### MongoDB (Database)
- Cloud-hosted on **MongoDB Atlas** (free tier)
- Stores 4 collections: `drivers`, `buses`, `routes`, `pickuprequests`
- We use **Mongoose** as the ODM (Object Data Modeling) library to define schemas and interact with MongoDB from Node.js

### Express.js (Backend Framework)
- Handles all HTTP requests (GET, POST, PUT)
- Organizes code into **Routes → Controllers → Models** pattern
- Middleware for authentication (JWT) and Socket.IO injection

### React (Frontend Library)
- Single Page Application (SPA) using **React Router** for client-side navigation
- Uses **React Hooks** extensively (explained in Section 7)
- **Leaflet.js** for interactive maps (not Google Maps)

### React Native + Expo (Mobile App)
- Cross-platform mobile app (Android/iOS)
- **Expo Location** for GPS tracking in background
- **React Navigation** for screen-to-screen movement

### Socket.IO (Real-Time Communication)
- WebSocket-based library for instant updates
- When a driver sends GPS coordinates, ALL connected passengers see the bus move immediately — no page refresh needed

---

## 3. Project Folder Structure

```
nova/
├── backend/                    # Node.js API Server
│   ├── server.js               # Entry point — starts Express + Socket.IO
│   ├── config/
│   │   └── db.js               # MongoDB connection using Mongoose
│   ├── models/                 # Mongoose Schemas (database structure)
│   │   ├── Driver.js           # Driver account schema
│   │   ├── Bus.js              # Bus details + live location schema
│   │   ├── Route.js            # Bus route schema (source, stops, destination)
│   │   └── PickupRequest.js    # Passenger pickup request schema
│   ├── routes/                 # Express Router files (URL definitions)
│   │   ├── authRoutes.js       # /api/auth/* endpoints
│   │   ├── busRoutes.js        # /api/buses/* endpoints
│   │   └── routeRoutes.js      # /api/routes/* endpoints
│   ├── controllers/            # Business logic for each route
│   │   ├── authController.js   # Register, Login, Me
│   │   └── busController.js    # CRUD, location updates, pickup requests
│   ├── middleware/
│   │   └── auth.js             # JWT token verification middleware
│   └── utils/
│       ├── offline.js          # Bus availability status computation
│       └── coords.js           # Haversine distance + geo math
│
├── frontend/                   # React Website (Vite)
│   ├── src/
│   │   ├── App.jsx             # Root component with React Router
│   │   ├── main.jsx            # Entry point — renders App into DOM
│   │   ├── styles.css          # Global CSS styles
│   │   ├── components/
│   │   │   ├── Navbar.jsx      # Navigation bar component
│   │   │   └── AvailabilityBadge.jsx  # Status badge (Running/Offline/Inactive)
│   │   ├── pages/
│   │   │   ├── Home.jsx            # Landing page
│   │   │   ├── RouteSelection.jsx  # Browse/search bus routes
│   │   │   ├── BusListing.jsx      # List buses on a selected route
│   │   │   ├── BusDetails.jsx      # Bus info + map + pickup requests
│   │   │   ├── LiveTracking.jsx    # Full-screen live tracking map
│   │   │   ├── AllBusesMap.jsx     # All buses on one map
│   │   │   └── NearbyBuses.jsx     # Find buses near your GPS location
│   │   └── services/
│   │       ├── api.js              # Axios instance for REST API calls
│   │       └── utils.js            # Helper functions (ETA, distance, status)
│
├── mobile/                     # React Native Driver App (Expo)
│   ├── App.js                  # Entry point with React Navigation
│   ├── screens/
│   │   ├── LoginScreen.js      # Driver login
│   │   ├── RegisterScreen.js   # Driver registration
│   │   ├── DashboardScreen.js  # Driver dashboard (bus info)
│   │   ├── BusSetupScreen.js   # Register/edit bus details
│   │   └── TripScreen.js       # Start/stop trip + manage pickup requests
│   ├── services/
│   │   ├── api.js              # Axios instance + all API functions
│   │   ├── tripService.js      # Trip state management (singleton pattern)
│   │   └── locationTask.js     # Background GPS task definition
│   └── components/
│       └── styles.js           # Shared styles + color constants
```

---

## 4. Database Models (Mongoose Schemas)

### Driver Model
```javascript
{
  name: String,          // "Sahil"
  phone: String,         // "9041841279" (unique, used for login)
  dlNumber: String,      // "PB1020150123456" (Driving License)
  password: String,      // Hashed with bcryptjs
  assignedBusId: ObjectId // Reference to Bus collection
}
```

### Bus Model
```javascript
{
  busNumber: String,     // "PB08FQ7469"
  busBrand: String,      // "Punjab Roadways" | "PRTC" | "PunBus" | "Private"
  busType: String,       // "government" | "private"
  driverId: ObjectId,    // Reference → Driver (who drives this bus)
  routeId: ObjectId,     // Reference → Route (which route it runs on)
  tripStarted: Boolean,  // Is the driver currently on a trip?
  isFull: Boolean,       // Has the driver marked the bus as full?
  acceptingRequests: Boolean,
  capacity: Number,      // Default 40
  occupancy: Number,     // Current passenger count
  currentLocation: {
    latitude: Number,
    longitude: Number,
    heading: Number,     // Compass direction (0-360)
    speed: Number,       // Meters per second
    lastUpdated: Date    // When was the last GPS ping received
  }
}
```
**Key concept — `ref` and `.populate()`**: The `driverId` and `routeId` fields store just an ObjectId (like a foreign key). When we call `.populate("routeId")`, Mongoose replaces the ID with the full Route document. This is how we get stop names on the frontend without a second API call.

### Route Model
```javascript
{
  routeName: String,     // "Chandigarh → Hoshiarpur"
  source: String,        // "Chandigarh"
  destination: String,   // "Hoshiarpur"
  stops: [String],       // ["Rupnagar", "Balachaur", "Garhshankar", "Mahilpur"]
  routeType: String      // "intercity"
}
```

### PickupRequest Model
```javascript
{
  passengerId: String,   // Random ID stored in localStorage
  busId: ObjectId,       // Which bus
  routeId: ObjectId,     // Which route
  stopName: String,      // "Chandigarh"
  status: String         // "sent" → "accepted" → "approaching" → "arrived" → "completed"
}
```

---

## 5. REST API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Auth? | What it does |
|---|---|---|---|
| POST | `/register` | No | Create a new driver account |
| POST | `/login` | No | Login with phone + password, get JWT token |
| GET | `/me` | Yes | Get the logged-in driver's profile |

### Buses (`/api/buses`)
| Method | Endpoint | Auth? | What it does |
|---|---|---|---|
| GET | `/` | No | List all buses (with populated route + driver) |
| GET | `/:id` | No | Get one bus by ID |
| GET | `/mine` | Yes | Get the logged-in driver's bus |
| GET | `/route/:routeId` | No | Get all buses on a specific route |
| POST | `/register` | Yes | Register a new bus for the logged-in driver |
| PUT | `/:id/location` | Yes | Update bus GPS coordinates (called every 10s) |
| POST | `/:id/start-trip` | Yes | Mark trip as started |
| POST | `/:id/stop-trip` | Yes | Mark trip as stopped |
| POST | `/:id/pickup-request` | No | Passenger creates a pickup request |
| GET | `/:id/pickup-requests` | No | Get all active pickup requests for a bus |

### Routes (`/api/routes`)
| Method | Endpoint | Auth? | What it does |
|---|---|---|---|
| GET | `/` | No | List all bus routes |
| GET | `/:id` | No | Get one route by ID |

---

## 6. Authentication Flow (JWT)

```
Driver opens app → Enters phone + password → POST /api/auth/login
                                                    ↓
                                        Server checks password with bcrypt.compare()
                                                    ↓
                                        Creates JWT token: jwt.sign({ id: driver._id }, SECRET, { expiresIn: "30d" })
                                                    ↓
                                        Returns { token: "eyJhbG...", driver: {...} }
                                                    ↓
                            Mobile app saves token in AsyncStorage
                                                    ↓
                    Every future API call includes: Authorization: Bearer eyJhbG...
                                                    ↓
                        auth.js middleware verifies token → sets req.driverId
```

**Key concepts used:**
- **bcryptjs** — Hashes passwords before storing. `bcrypt.hash(password, 10)` to hash, `bcrypt.compare(input, hash)` to verify
- **jsonwebtoken (JWT)** — Creates a signed token containing the driver's ID. Expires in 30 days. Server verifies it on every protected request
- **AsyncStorage** — React Native's equivalent of localStorage. Persists the token even when the app closes

---

## 7. React Hooks Used (Frontend)

### `useState` — Store and update data
```javascript
const [bus, setBus] = useState(null);
// bus = current value, setBus = function to update it
// When setBus() is called, the component re-renders with the new value
```
**Used everywhere** — storing bus data, user location, loading states, form inputs.

### `useEffect` — Run code when something changes
```javascript
useEffect(() => {
  getBus(busId).then((b) => setBus(b));     // Runs when component mounts
  socket.on("busLocationUpdate", handler);   // Subscribe to socket events
  return () => socket.off("busLocationUpdate", handler); // Cleanup on unmount
}, [busId]); // Dependency array — re-run only when busId changes
```
**Used for**: Fetching data on page load, subscribing to Socket.IO, starting geolocation watch, setting up timers.

### `useMemo` — Cache expensive calculations
```javascript
const nearbyBuses = useMemo(() => {
  return buses.filter(b => b.distance <= radius).sort((a, b) => a.distance - b.distance);
}, [buses, radius]);
// Only recalculates when buses or radius actually change
```
**Used for**: Filtering/sorting bus lists, computing route waypoints, calculating ETAs.

### `useRef` — Store values that persist across re-renders (without causing re-render)
```javascript
const lastMovedPosRef = useRef(null);
// Unlike useState, changing a ref does NOT trigger a re-render
// Used for: tracking last GPS position, storing timer IDs, one-time flags
```

### `useCallback` — Cache function references
```javascript
const loadBusAndRequests = useCallback(async () => {
  const b = await getMyBus();
  setBus(b);
}, [busId]);
// Prevents creating a new function on every render
```

### `useParams` — Read URL parameters (React Router)
```javascript
const { busId } = useParams();
// URL: /buses/abc123 → busId = "abc123"
```

### `useNavigate` — Programmatic navigation (React Router)
```javascript
const navigate = useNavigate();
navigate(`/buses/${bus._id}`); // Go to bus details page
```

### `useMap` — Access Leaflet map instance (react-leaflet)
```javascript
const map = useMap();
map.fitBounds(bounds); // Zoom map to fit all markers
map.flyTo([lat, lng], 14); // Animate to a location
```

---

## 8. React Router — Client-Side Routing

```javascript
// App.jsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/routes" element={<RouteSelection />} />
  <Route path="/routes/:routeId/buses" element={<BusListing />} />
  <Route path="/buses/:busId" element={<BusDetails />} />
  <Route path="/buses/:busId/track" element={<LiveTracking />} />
  <Route path="/all-buses" element={<AllBusesMap />} />
  <Route path="/nearby-buses" element={<NearbyBuses />} />
</Routes>
```

**How it works:** When you click a `<Link to="/routes">`, React Router does NOT reload the page. It just swaps the component rendered inside `<Routes>`. This is why the app feels fast — it's a **Single Page Application (SPA)**.

**Dynamic routes:** `:busId` is a URL parameter. When the URL is `/buses/abc123`, the `BusDetails` component reads `abc123` using `useParams()`.

---

## 9. Socket.IO — Real-Time Communication

### Why not just use REST API polling?
Polling means the frontend calls `GET /api/buses` every 2 seconds. With 100 users, that's 50 requests/second hitting the server for no reason (most times, nothing changed).

Socket.IO keeps a **persistent WebSocket connection** open. The server pushes updates ONLY when something actually changes.

### How it works in NOVA:

```
STEP 1: Server setup (server.js)
─────────────────────────────────
const io = new Server(server, { cors: { origin: "*" } });
// Creates a Socket.IO server on top of the HTTP server

app.use((req, res, next) => {
  req.io = io;    // Attach io to every request so controllers can use it
  next();
});


STEP 2: Driver sends GPS (mobile → backend)
─────────────────────────────────────────────
// Mobile app calls REST API every 10 seconds:
PUT /api/buses/:id/location  { latitude: 30.73, longitude: 76.77 }


STEP 3: Backend saves + broadcasts (busController.js)
──────────────────────────────────────────────────────
bus.currentLocation = { latitude, longitude, lastUpdated: new Date() };
await bus.save();
req.io.emit("busLocationUpdate", bus);
// ↑ This sends the updated bus to ALL connected clients instantly


STEP 4: Frontend receives (BusDetails.jsx)
───────────────────────────────────────────
socket.on("busLocationUpdate", (updatedBus) => {
  if (updatedBus._id === busId) {
    setBus(prev => ({
      ...prev,
      currentLocation: updatedBus.currentLocation
    }));
  }
});
// The map marker moves to the new position automatically!
```

### Socket Events in NOVA:
| Event Name | Direction | Purpose |
|---|---|---|
| `busLocationUpdate` | Server → All Clients | Bus moved — update marker on map |
| `pickupRequestUpdate` | Server → All Clients | Pickup request status changed |

---

## 10. Mobile App — Background Location Tracking

### The Problem
When the driver minimizes the app or turns off the screen, normal JavaScript stops running. GPS updates would stop.

### The Solution — Expo Background Location Task

```javascript
// locationTask.js — Registered at the TOP LEVEL (not inside any component)
TaskManager.defineTask("nova-background-location", async ({ data }) => {
  const loc = data.locations[0];
  const busId = await AsyncStorage.getItem("nova_active_bus_id");
  await updateLocation(busId, loc.coords.latitude, loc.coords.longitude);
});

// tripService.js — When driver taps "Start Trip"
Location.startLocationUpdatesAsync("nova-background-location", {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 10000,  // Every 10 seconds
  foregroundService: {
    notificationTitle: "NOVA — Trip Active",
    notificationBody: "Sharing your location with passengers every 10 s",
  },
});
```

**Key concept — `TaskManager.defineTask()`** must be called at the module's top level (outside any function/component). The OS kills the JS runtime when the app is in the background, but it will wake it up and run this task when new GPS data arrives.

---

## 11. Bus Availability Status System

Every bus has one of three states, computed automatically from the `lastUpdated` timestamp:

```
┌─────────────┬────────────────────────────────────────────┬─────────┐
│   Status    │ Condition                                  │  Color  │
├─────────────┼────────────────────────────────────────────┼─────────┤
│  Running    │ GPS ping received within last 2 minutes    │  Green  │
│  Offline    │ GPS ping received today but > 2 min ago    │  Orange │
│  Inactive   │ No GPS ping today (or ever)                │  Grey   │
└─────────────┴────────────────────────────────────────────┴─────────┘
```

This is computed in TWO places (must stay in sync):
1. **Backend** — `utils/offline.js` → `computeStatus(bus)`
2. **Frontend** — `services/utils.js` → `getAvailabilityStatus(bus)`

After midnight, all buses auto-reset to "inactive" until their first GPS ping of the new day.

---

## 12. Smart Pickup Request System

### Flow:
```
Passenger opens bus page → Browser gets their GPS location
        ↓
Finds nearest stop on the bus route (using Haversine formula)
        ↓
If within 20 km of a stop → Shows "Request Pickup" button
        ↓
Passenger taps button → POST /api/buses/:id/pickup-request
        ↓
Driver sees the request on TripScreen → Can Accept/Reject
        ↓
Status updates: sent → accepted → approaching → arrived → completed
        ↓
If bus passes a stop → Backend auto-marks requests as "passed"
```

### Auto-Pass Logic (Backend)
When a driver sends a GPS update, the backend:
1. Gets the bus's route waypoints
2. Finds which road segment the bus is currently on
3. Any stops BEFORE the current segment with active requests get auto-marked as "passed"

---

## 13. Map Implementation (Leaflet)

We use **react-leaflet** (React wrapper for Leaflet.js) — a free, open-source map library.

**Key components used:**
| Component | Purpose |
|---|---|
| `<MapContainer>` | Creates the map canvas |
| `<TileLayer>` | Loads map tiles (we use CartoDB free tiles) |
| `<Marker>` | Places a pin on the map |
| `<Popup>` | Info box that opens when you click a marker |
| `<Polyline>` | Draws a line (route path) on the map |
| `<Circle>` | Draws a radius circle (nearby buses feature) |

**Route line drawing:** We use the free **OSRM API** to get road-following geometry between stops. Without OSRM, lines would be straight (not following roads).

---

## 14. Key Algorithms

### Haversine Formula
Calculates the straight-line distance between two GPS coordinates on Earth's curved surface.
```javascript
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371; // Earth's radius in km
  // ... math using sin, cos, atan2
  return distanceInKm;
}
```
**Used for:** Finding nearest bus, nearest stop, checking if passenger is within range.

### ETA Calculation
```
ETA = distance / speed
If speed < 2 m/s (7.2 km/h) → use 40 km/h as fallback
Format: "3:18 AM (51 min)" or "4:28 AM (2h 1m)" if > 59 min
```

---

## 15. Environment Variables

### Backend `.env`
```
PORT=5000                    # Server port
MONGO_URI=mongodb+srv://...  # MongoDB Atlas connection string
JWT_SECRET=your_secret_key   # Secret for signing JWT tokens
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api   # Backend API URL
```
Note: Vite requires env variables to start with `VITE_` to be accessible in browser code.

---

## 16. Complete Data Flow Example

**"Passenger tracks a bus from Chandigarh to Hoshiarpur":**

```
1. Passenger opens website → Home.jsx loads
2. Clicks "Find my bus" → navigates to /routes (RouteSelection.jsx)
3. Frontend calls GET /api/routes → shows list of all routes
4. Clicks "Chandigarh → Hoshiarpur" → navigates to /routes/:routeId/buses
5. Frontend calls GET /api/buses/route/:routeId → shows buses on this route
6. Clicks a running bus → navigates to /buses/:busId (BusDetails.jsx)
7. Frontend calls GET /api/buses/:id → gets full bus data with populated route
8. useEffect subscribes to socket "busLocationUpdate" event
9. Map renders with Leaflet: bus marker + route polyline + stop markers
10. Every 10s, driver's phone sends PUT /api/buses/:id/location
11. Backend saves to MongoDB → emits socket event
12. Frontend receives event → updates bus state → marker moves on map
```
