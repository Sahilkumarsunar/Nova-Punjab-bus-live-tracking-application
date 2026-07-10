import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getBus } from "../services/api";
import { io } from "socket.io-client";

// Assuming backend runs on the same domain or configure via env if needed
// A common approach is using the base URL from API or hardcoding for local dev
const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : "http://localhost:5000";
const socket = io(SOCKET_URL);

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CITY_COORDS = {
  "Ludhiana": [30.9010, 75.8573],
  "Amritsar": [31.6340, 74.8723],
  "Chandigarh": [30.7333, 76.7794],
  "Jalandhar": [31.3260, 75.5762],
  "Patiala": [30.3398, 76.3869],
  "Bathinda": [30.2110, 74.9455],
  "Pathankot": [32.2747, 75.6522],
  "Moga": [30.8162, 75.1741],
  "Ferozepur": [30.9337, 74.6136],
  "Hoshiarpur": [31.5318, 75.9115],
  "Mansa": [29.9988, 75.3881],
  "Sangrur": [30.2330, 75.8410],
  "Barnala": [30.3819, 75.5482],
  "Faridkot": [30.6770, 74.7583],
  "Tarn Taran": [31.4524, 74.9275],
  "Gurdaspur": [32.0414, 75.4035],
  "Kapurthala": [31.3796, 75.3809],
  "Khanna": [30.6976, 76.2174],
  "Rajpura": [30.4838, 76.5927],
  "Beas": [31.5133, 75.1707],
  "Phagwara": [31.2240, 75.7708],
  "Batala": [31.8180, 75.2035],
  "Maur": [30.0808, 75.2264],
  "Budhlada": [29.9274, 75.5592],
  "Zira": [30.9680, 74.9928],
  "Jagraon": [30.7897, 75.4705],
  "Adampur": [31.4320, 75.7163],
  "Mukerian": [31.9520, 75.6165],
  "Dasuya": [31.8170, 75.6530],
  "Sirhind": [30.6453, 76.3896],
  "Chabal": [31.5498, 74.8820],
  "Makhu": [31.1045, 74.9998],
  "Kotkapura": [30.5850, 74.8178],
  "Kot Kapura": [30.5850, 74.8178],
  "Bhikhi": [30.0488, 75.5350],
  "Mehal Kalan": [30.3290, 75.6630],
  "Raikot": [30.6520, 75.6070],
  "Dinanagar": [32.1392, 75.4678],
  "Kartarpur": [31.4440, 75.5006],
  "Mohali": [30.7046, 76.7179],
  "Abohar": [30.1453, 74.1993],
  "Malerkotla": [30.5225, 75.8828],
  "Muktsar": [30.4816, 74.5209],
  "Fazilka": [30.4031, 74.0253],
  "Kharar": [30.7431, 76.6457],
  "Nabha": [30.3734, 76.1477],
  "Sunam": [30.1345, 75.8010],
  "Dhuri": [30.3700, 75.8700],
  "Rupnagar": [30.9664, 76.5331],
  "Nawanshahr": [31.1256, 76.1158],
  "Zirakpur": [30.6424, 76.8173],
  "Nakodar": [31.1278, 75.4745],
  "Patti": [31.2828, 74.8622],
  "Samana": [30.1582, 76.1923],
  "Phillaur": [31.0258, 75.7865],
  "Rampura Phul": [30.2721, 75.2415],
  "Samrala": [30.8359, 76.1855],
  "Jandiala": [31.5540, 75.0210],
  "Goniana": [30.3168, 74.9080],
  "Mullanpur": [30.8267, 75.6321],
  "Baghapurana": [30.5898, 75.0841],
  "Malout": [30.1982, 74.4952],
  "Giddarbaha": [30.1983, 74.6548],
  "Mahilpur": [31.3541, 76.0526],
  "Garhshankar": [31.2131, 76.1450],
  "Balachaur": [31.0505, 76.3072],
  "Bhawanigarh": [30.2644, 76.0425],
  "Tanda": [31.6705, 75.6397],
  "Bhogpur": [31.5458, 75.6416]
};
const PUNJAB_CENTER = [31.1471, 75.3412];

const stopIcon = new L.DivIcon({
  html: `<div style="
    width: 12px; height: 12px; border-radius: 50%;
    background: #d97706; border: 2.5px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  "></div>`,
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const busStandIcon = new L.DivIcon({
  html: `<div style="
    width: 16px; height: 16px; border-radius: 50%;
    background: #d97706; border: 3px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    opacity: 0.75;
  "></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const endpointIcon = new L.DivIcon({
  html: `<div style="
    width: 16px; height: 16px; border-radius: 50%;
    background: #0d9488; border: 3px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  "></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function makeBusIcon(isMoving, heading) {
  const hasHeading = typeof heading === "number" && heading >= 0;
  const arrowColor = isMoving ? "#16a34a" : "#6b7280";
  return new L.DivIcon({
    html: `
      <div class="bus-marker-wrap ${isMoving ? 'bus-is-moving' : 'bus-is-parked'}" style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        ${isMoving ? '<div class="bus-ping-ring"></div>' : ''}
        ${hasHeading ? `
          <div style="
            position: absolute; top: -10px; left: 50%; transform: translateX(-50%) rotate(${heading}deg);
            width: 0; height: 0;
            border-left: 7px solid transparent;
            border-right: 7px solid transparent;
            border-bottom: 14px solid ${arrowColor};
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            z-index: 2;
          "></div>
        ` : ''}
        <div class="bus-marker-dot">
          <span style="font-size:14px;line-height:1;">🚌</span>
        </div>
      </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

async function fetchRoadRoute(waypoints) {
  if (waypoints.length < 2) return waypoints;

  const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
  } catch (err) {
    console.warn("OSRM routing failed, falling back to straight lines:", err);
  }

  return waypoints;
}

// Haversine formula — straight-line distance in km between two [lat, lng] points
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Total route distance by summing waypoint segments
function calcTotalDistance(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++)
    total += haversineKm(coords[i], coords[i + 1]);
  return total;
}

// Project point P onto segment AB using equirectangular approximation.
// Returns { t ∈ [0,1] } — how far along AB the foot of the perpendicular is,
// plus the projected [lat, lon] so we can measure perpendicular distance.
function projectOnSegment([pLat, pLon], [aLat, aLon], [bLat, bLon]) {
  // Scale longitude by cos(midLat) so degrees become roughly equal in length
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const ax = aLon * cosLat, ay = aLat;
  const bx = bLon * cosLat, by = bLat;
  const px = pLon * cosLat, py = pLat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, projLat: aLat, projLon: aLon };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { t, projLat: ay + t * dy, projLon: (ax + t * dx) / cosLat };
}

// Split the route polyline at the bus's current position.
// Returns coveredPath (start → bus) and remainingPath (bus → end).
function splitRouteAtBus(routeCoords, busPos) {
  if (!busPos || routeCoords.length < 2)
    return { coveredPath: [], remainingPath: routeCoords };
  let minPerpDist = Infinity;
  let bestIdx = 0;
  let bestProjPt = null;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const { projLat, projLon } = projectOnSegment(
      busPos, routeCoords[i], routeCoords[i + 1]
    );
    const perpDist = haversineKm(busPos, [projLat, projLon]);
    if (perpDist < minPerpDist) {
      minPerpDist = perpDist;
      bestIdx = i;
      bestProjPt = [projLat, projLon];
    }
  }
  return {
    coveredPath:   [...routeCoords.slice(0, bestIdx + 1), bestProjPt],
    remainingPath: [bestProjPt, ...routeCoords.slice(bestIdx + 1)],
  };
}

// Accurate distance covered:
// For every segment, find the perpendicular foot from the bus to that segment.
// Choose the segment with the smallest perpendicular distance → that is where
// the bus is. The covered distance is: all complete segments before it + the
// fractional distance t × segmentLength into that segment.
function calcCoveredDistance(routeCoords, busPos) {
  if (!busPos || routeCoords.length < 2) return null;
  let minPerpDist = Infinity;
  let bestCovered = 0;
  let segStart = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const segLen = haversineKm(routeCoords[i], routeCoords[i + 1]);
    const { t, projLat, projLon } = projectOnSegment(
      busPos, routeCoords[i], routeCoords[i + 1]
    );
    const perpDist = haversineKm(busPos, [projLat, projLon]);
    if (perpDist < minPerpDist) {
      minPerpDist = perpDist;
      bestCovered = segStart + t * segLen;
    }
    segStart += segLen;
  }
  return bestCovered;
}

function FitBounds({ positions }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (positions.length > 1 && !hasFittedRef.current) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
      hasFittedRef.current = true;
    }
  }, [positions, map]);
  return null;
}

export default function LiveTracking() {
  const { busId } = useParams();
  const [bus, setBus] = useState(null);
  const [roadGeometry, setRoadGeometry] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Refs to track last known position where movement was detected
  const lastMovedPosRef  = useRef(null); // [lat, lng]
  const lastMovedTimeRef = useRef(null); // timestamp ms

  useEffect(() => {
    const load = () => getBus(busId).then((b) => setBus(b)).catch(console.error);
    load();

    const handleLocationUpdate = (updatedBus) => {
      if (updatedBus._id === busId) {
        setBus((prev) => {
          if (!prev) return updatedBus;
          return {
            ...prev,
            currentLocation: updatedBus.currentLocation,
            status: updatedBus.status,
            tripStarted: updatedBus.tripStarted
          };
        });
      }
    };

    socket.on("busLocationUpdate", handleLocationUpdate);

    return () => {
      socket.off("busLocationUpdate", handleLocationUpdate);
    };
  }, [busId]);

  // Movement detection — runs every time bus data arrives
  useEffect(() => {
    if (!bus?.currentLocation?.latitude) {
      setIsMoving(false);
      return;
    }

    const pos = [bus.currentLocation.latitude, bus.currentLocation.longitude];
    const now = Date.now();

    if (lastMovedPosRef.current === null) {
      // First position seen — initialise refs, don't animate yet
      lastMovedPosRef.current  = pos;
      lastMovedTimeRef.current = now;
      setIsMoving(false);
      return;
    }

    const dist = haversineKm(lastMovedPosRef.current, pos);
    if (dist > 0.05) {
      // Bus moved more than 50 m — reset the "last moved" clock
      lastMovedPosRef.current  = pos;
      lastMovedTimeRef.current = now;
    }

    const timeSinceMove = now - lastMovedTimeRef.current;
    const moving = timeSinceMove < 60 * 1000; // stationary if no move for 60 s
    setIsMoving(moving);

    // Auto-flip to parked after the remaining 60-second window
    if (moving) {
      const remaining = 60 * 1000 - timeSinceMove;
      const flip = setTimeout(() => setIsMoving(false), remaining);
      return () => clearTimeout(flip);
    }
  }, [bus]);

  const loc = bus?.currentLocation;
  const hasLoc = loc && loc.latitude != null && loc.longitude != null;
  const busPos = hasLoc ? [loc.latitude, loc.longitude] : null;
  const last = loc?.lastUpdated ? new Date(loc.lastUpdated).toLocaleString() : "Never";

  const route = bus?.routeId;
  const routeWaypoints = useMemo(() => {
    if (!route) return [];
    const points = [];

    const srcCoord = CITY_COORDS[route.source];
    if (srcCoord) points.push({ name: route.source, coord: srcCoord, type: "endpoint" });

    if (route.stops) {
      for (const stop of route.stops) {
        const coord = CITY_COORDS[stop];
        if (coord) points.push({ name: stop, coord, type: "stop" });
      }
    }

    const dstCoord = CITY_COORDS[route.destination];
    if (dstCoord) points.push({ name: route.destination, coord: dstCoord, type: "endpoint" });

    return points;
  }, [route]);

  const waypointKey = useMemo(
    () => routeWaypoints.map((wp) => wp.coord.join(",")).join("|"),
    [routeWaypoints]
  );

  useEffect(() => {
    if (routeWaypoints.length < 2) {
      setRoadGeometry([]);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);

    const coords = routeWaypoints.map((wp) => wp.coord);
    fetchRoadRoute(coords).then((geometry) => {
      if (!cancelled) {
        setRoadGeometry(geometry);
        setRouteLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [waypointKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const markerPositions = routeWaypoints.map((wp) => wp.coord);
  const polylinePositions = roadGeometry.length > 0 ? roadGeometry : markerPositions;
  const allPositions = busPos
    ? [...markerPositions, busPos]
    : markerPositions;

  // Bus-stand snapping: if a waypoint is >2 km from the road, the bus drops
  // passengers at the nearest road point (not inside the bus stand).
  const snappedWaypoints = useMemo(() => {
    if (roadGeometry.length === 0) return routeWaypoints;
    return routeWaypoints.map((wp) => {
      let minDist = Infinity;
      let snapPt = wp.coord;
      for (let i = 0; i < roadGeometry.length - 1; i++) {
        const { projLat, projLon } = projectOnSegment(
          wp.coord, roadGeometry[i], roadGeometry[i + 1]
        );
        const d = haversineKm(wp.coord, [projLat, projLon]);
        if (d < minDist) { minDist = d; snapPt = [projLat, projLon]; }
      }
      const isOffRoute = minDist > 2; // more than 2 km from road
      return {
        ...wp,
        // Marker sits on the road drop-off point when off-route
        coord: isOffRoute ? snapPt : wp.coord,
        // Keep original city coord to draw dashed connector
        busStandCoord: isOffRoute ? wp.coord : null,
        busStandDist: isOffRoute ? minDist : null,
      };
    });
  }, [routeWaypoints, roadGeometry]);

  // Signal status: how long ago was the last GPS ping?
  const signalAgeMs = loc?.lastUpdated
    ? Date.now() - new Date(loc.lastUpdated).getTime()
    : null;
  const signalStatus = !hasLoc
    ? "none"
    : signalAgeMs < 2 * 60 * 1000
    ? "live"      // updated within 2 min
    : signalAgeMs < 10 * 60 * 1000
    ? "stale"     // 2–10 min ago
    : "lost";     // older than 10 min

  const signalConfig = {
    live:  { color: "#16a34a", bg: "rgba(22,163,74,0.12)",  label: "Signal Live",  dot: true  },
    stale: { color: "#d97706", bg: "rgba(217,119,6,0.12)",  label: "Signal Weak",  dot: false },
    lost:  { color: "#dc2626", bg: "rgba(220,38,38,0.10)",  label: "Signal Lost",  dot: false },
    none:  { color: "#9ca3af", bg: "rgba(156,163,175,0.12)",label: "No Signal",    dot: false },
  }[signalStatus];

  // Distance — use road geometry when OSRM has loaded (many dense points = accurate),
  // fall back to city waypoints before road geometry is ready.
  const distCoords = polylinePositions.length > 1 ? polylinePositions : markerPositions;
  const totalDist   = distCoords.length > 1 ? calcTotalDistance(distCoords) : null;
  const coveredDist = calcCoveredDistance(distCoords, busPos);
  const progressPct = totalDist && coveredDist != null
    ? Math.min(100, (coveredDist / totalDist) * 100)
    : null;

  // Split route into covered (green) and remaining (faded) segments
  const { coveredPath, remainingPath } = useMemo(
    () => splitRouteAtBus(distCoords, busPos),
    [distCoords, busPos]
  );

  // Dynamic bus icon — animated when moving, static when parked, shows direction
  const busIcon = useMemo(() => makeBusIcon(isMoving, loc?.heading), [isMoving, loc?.heading]);

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Tracking {bus?.busNumber || "…"}</h1>
          <p className="muted">
            <span className={`badge ${bus?.status === "active" ? "active" : "offline"}`}>
              {bus?.status || "—"}
            </span>
            <span style={{ marginLeft: 8 }}>Last updated: {last}</span>
          </p>
        </div>
        {/* Signal status pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: signalConfig.bg,
          color: signalConfig.color,
          padding: "8px 16px", borderRadius: "100px",
          fontWeight: 700, fontSize: 13, marginTop: 6,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            background: signalConfig.color,
            display: "inline-block",
            animation: signalStatus === "live" ? "pulse 2s infinite" : "none",
            flexShrink: 0,
          }} />
          {signalConfig.label}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="map" style={{ border: "none", borderRadius: 0 }}>
        <MapContainer center={busPos || PUNJAB_CENTER} zoom={hasLoc ? 13 : 8} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {allPositions.length > 1 && <FitBounds positions={allPositions} />}

          {/* Remaining route — faded dashed teal */}
          {remainingPath.length > 1 && (
            <Polyline
              positions={remainingPath}
              pathOptions={{
                color: "#0d9488",
                weight: 4,
                opacity: 0.45,
                dashArray: "10, 8",
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          )}

          {/* Covered route — solid bright green */}
          {coveredPath.length > 1 && (
            <Polyline
              positions={coveredPath}
              pathOptions={{
                color: "#16a34a",
                weight: 5,
                opacity: 0.95,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          )}

          {/* Full route fallback when bus has no location yet */}
          {!busPos && polylinePositions.length > 1 && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: "#0d9488",
                weight: 4,
                opacity: 0.7,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          )}

          {/* Dashed connectors from road drop-off to off-route bus stands */}
          {snappedWaypoints
            .filter((wp) => wp.busStandCoord)
            .map((wp, i) => (
              <Polyline
                key={`busstand-line-${i}`}
                positions={[wp.coord, wp.busStandCoord]}
                pathOptions={{
                  color: "#d97706",
                  weight: 2,
                  opacity: 0.7,
                  dashArray: "5, 6",
                }}
              />
            ))}

          {/* Stop / endpoint markers — snapped to road if bus stand is far off */}
          {snappedWaypoints.map((wp, i) => (
            <>
              {/* Road drop-off marker */}
              <Marker
                key={`stop-${i}`}
                position={wp.coord}
                icon={wp.type === "endpoint" ? endpointIcon : stopIcon}
              >
                <Popup>
                  <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    <strong>{wp.name}</strong><br />
                    {wp.busStandCoord ? (
                      <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>
                        🚏 Passengers dropped here (bus stand is {wp.busStandDist?.toFixed(1)} km off route)
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#78716c" }}>
                        {wp.type === "endpoint" ? "Start / End" : "Stop"}
                      </span>
                    )}
                  </div>
                </Popup>
              </Marker>
              {/* Actual bus stand marker (dimmed amber dot) */}
              {wp.busStandCoord && (
                <Marker
                  key={`busstand-${i}`}
                  position={wp.busStandCoord}
                  icon={busStandIcon}
                >
                  <Popup>
                    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      <strong>{wp.name} Bus Stand</strong><br />
                      <span style={{ fontSize: 12, color: "#d97706" }}>
                        🏛️ {wp.busStandDist?.toFixed(1)} km from route — bus does not enter
                      </span>
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          ))}

          {hasLoc && (
            <Marker position={busPos} icon={busIcon}>
              <Popup>
                <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <strong>{bus.busNumber}</strong><br />
                  <span style={{ fontSize: 12, color: "#78716c" }}>{bus.busBrand}</span><br />
                  <span style={{ fontSize: 12, color: "#78716c" }}>{route?.routeName}</span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      </div>

      {routeLoading && (
        <p className="muted" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="loading-spinner" style={{
            width: 14, height: 14, border: "2px solid #e7e5e4",
            borderTopColor: "#0d9488", borderRadius: "50%",
            display: "inline-block", animation: "spin 0.8s linear infinite",
          }} />
          Loading road directions…
        </p>
      )}

      {!hasLoc && !routeLoading && (
        <p className="muted" style={{ marginTop: 12 }}>
          Waiting for the driver to start the trip…
        </p>
      )}

      {/* Distance progress card */}
      {totalDist != null && (
        <div className="card" style={{ marginTop: 24, padding: "28px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17 }}>Distance Covered</h3>
            <div style={{ display: "flex", gap: 16, fontSize: 14, fontWeight: 600 }}>
              {coveredDist != null && (
                <span style={{ color: "#16a34a" }}>
                  📍 {coveredDist.toFixed(1)} km covered
                </span>
              )}
              <span style={{ color: "var(--ink-muted)" }}>
                🏁 {totalDist.toFixed(1)} km total
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{
            width: "100%", height: 12, background: "rgba(123,44,191,0.08)",
            borderRadius: 100, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: progressPct != null ? `${progressPct}%` : "0%",
              background: signalStatus === "live"
                ? "linear-gradient(90deg, #16a34a, #4ade80)"
                : "linear-gradient(90deg, var(--violet), var(--coral))",
              borderRadius: 100,
              transition: "width 1s ease",
            }} />
          </div>
          {progressPct != null && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)", fontWeight: 600 }}>
              {progressPct.toFixed(1)}% of route completed
            </div>
          )}
        </div>
      )}

      {route && (
        <div className="route-stops-panel">
          <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)" }}>
            Route: {route.routeName}
          </h3>
          <div className="stops-timeline">
            <div className="stop-item endpoint">
              <div className="stop-dot endpoint-dot"></div>
              <div className="stop-info">
                <strong>{route.source}</strong>
                <span className="stop-label">Start</span>
              </div>
            </div>
            {route.stops?.map((stop, i) => (
              <div className="stop-item" key={i}>
                <div className="stop-dot"></div>
                <div className="stop-info">
                  <span>{stop}</span>
                  <span className="stop-label">Stop {i + 1}</span>
                </div>
              </div>
            ))}
            <div className="stop-item endpoint">
              <div className="stop-dot endpoint-dot"></div>
              <div className="stop-info">
                <strong>{route.destination}</strong>
                <span className="stop-label">End</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
