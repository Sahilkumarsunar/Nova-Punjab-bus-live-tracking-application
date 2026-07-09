import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getBus, createPickupRequest, cancelPickupRequest, getActivePickupRequest } from "../services/api";
import { CITY_COORDS, haversineKm, formatETA, projectOnSegment, getAvailabilityStatus } from "../services/utils";
import AvailabilityBadge from "../components/AvailabilityBadge";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : "http://localhost:5000";
const socket = io(SOCKET_URL);

// Leaflet marker setup
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

function makeBusIcon(availabilityStatus, heading) {
  const hasHeading = typeof heading === "number" && heading >= 0;

  const cfg = {
    running:  { bg: "#16a34a", ringClass: "" },
    offline:  { bg: "#f97316", ringClass: null },
    inactive: { bg: "#9ca3af", ringClass: null },
  }[availabilityStatus] ?? { bg: "#9ca3af", ringClass: null };

  const arrowHtml = hasHeading && cfg.ringClass !== null
    ? `<div style="
        position: absolute; top: -10px; left: 50%;
        transform: translateX(-50%) rotate(${heading}deg);
        width: 0; height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-bottom: 14px solid ${cfg.bg};
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        z-index: 2;
      "></div>`
    : "";

  const ringHtml = cfg.ringClass !== null
    ? `<div class="bus-ping-ring ${cfg.ringClass}" style="
        position: absolute; inset: -2px; border-radius: 50%;
        border: 3px solid ${cfg.bg}; z-index: 0;
      "></div>`
    : "";

  return new L.DivIcon({
    html: `<div class="bus-marker-wrap">
      ${arrowHtml}
      ${ringHtml}
      <div class="bus-marker-dot" style="background:${cfg.bg};${availabilityStatus === 'inactive' ? 'filter:grayscale(1);opacity:.65;' : ''}">
        <span style="font-size:14px;line-height:1;">🚌</span>
      </div>
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Fetch routing geometry from OSRM
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

// Auto fit bounds helper component
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

export default function BusDetails() {
  const { busId } = useParams();
  const [bus, setBus] = useState(null);
  const [roadGeometry, setRoadGeometry] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Refs for tracking movement
  const lastMovedPosRef = useRef(null);
  const lastMovedTimeRef = useRef(null);

  // ── Smart Pickup Request States ──
  const [passengerPos, setPassengerPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);
  const [currentStopName, setCurrentStopName] = useState(null);
  const [isNearStop, setIsNearStop] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);

  const passengerId = useMemo(() => {
    let pid = localStorage.getItem("nova_passenger_id");
    if (!pid) {
      pid = "passenger_" + Math.random().toString(36).substring(2, 11);
      localStorage.setItem("nova_passenger_id", pid);
    }
    return pid;
  }, []);

  // 1. Fetch bus details on mount and hook up Socket.io
  useEffect(() => {
    let cancelled = false;
    const loadBus = () => getBus(busId).then((b) => {
      if (!cancelled) setBus(b);
    }).catch(console.error);
    loadBus();

    getActivePickupRequest(busId, passengerId).then((req) => {
      if (!cancelled) setActiveRequest(req);
    }).catch(console.error);

    const handleLocationUpdate = (updatedBus) => {
      if (updatedBus._id === busId && !cancelled) {
        setBus((prev) => {
          if (!prev) return updatedBus;
          return {
            ...prev,
            currentLocation: updatedBus.currentLocation,
            status: updatedBus.status,
            tripStarted: updatedBus.tripStarted,
            isFull: updatedBus.isFull,
            acceptingRequests: updatedBus.acceptingRequests,
            occupancy: updatedBus.occupancy,
          };
        });
      }
    };

    const handlePickupUpdate = (data) => {
      if (data.busId === busId && data.request && data.request.passengerId === passengerId && !cancelled) {
        setActiveRequest(data.request);
      }
    };

    socket.on("busLocationUpdate", handleLocationUpdate);
    socket.on("pickupRequestUpdate", handlePickupUpdate);

    return () => {
      cancelled = true;
      socket.off("busLocationUpdate", handleLocationUpdate);
      socket.off("pickupRequestUpdate", handlePickupUpdate);
    };
  }, [busId, passengerId]);

  // 2. Movement detection
  useEffect(() => {
    if (!bus?.currentLocation?.latitude) {
      setIsMoving(false);
      return;
    }

    const pos = [bus.currentLocation.latitude, bus.currentLocation.longitude];
    const now = Date.now();

    if (lastMovedPosRef.current === null) {
      lastMovedPosRef.current = pos;
      lastMovedTimeRef.current = now;
      setIsMoving(false);
      return;
    }

    const dist = haversineKm(lastMovedPosRef.current, pos);
    if (dist > 0.05) {
      lastMovedPosRef.current = pos;
      lastMovedTimeRef.current = now;
    }

    const timeSinceMove = now - lastMovedTimeRef.current;
    const moving = timeSinceMove < 60 * 1000;
    setIsMoving(moving);

    if (moving) {
      const remaining = 60 * 1000 - timeSinceMove;
      const flip = setTimeout(() => setIsMoving(false), remaining);
      return () => clearTimeout(flip);
    }
  }, [bus]);

  // 3. Extract coordinates and route details
  const route = bus?.routeId;
  const loc = bus?.currentLocation;
  const hasLoc = loc && loc.latitude != null && loc.longitude != null;
  const busPos = hasLoc ? [loc.latitude, loc.longitude] : null;

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

  // 4. Load OSRM road geometry
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

    return () => {
      cancelled = true;
    };
  }, [routeWaypoints]);

  // 5. Calculate stop statuses and ETAs
  const stopsStatusAndETA = useMemo(() => {
    if (routeWaypoints.length === 0) return [];
    if (!busPos) {
      return routeWaypoints.map((wp) => ({
        ...wp,
        status: "upcoming",
        eta: "Not Started",
      }));
    }

    // A. Find the segment the bus is closest to
    let minPerpDist = Infinity;
    let activeSegIdx = 0;

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      const { projLat, projLon } = projectOnSegment(
        busPos,
        routeWaypoints[i].coord,
        routeWaypoints[i + 1].coord
      );
      const dist = haversineKm(busPos, [projLat, projLon]);
      if (dist < minPerpDist) {
        minPerpDist = dist;
        activeSegIdx = i;
      }
    }

    // Check snapping to start/end stops of segment
    const distToStart = haversineKm(busPos, routeWaypoints[activeSegIdx].coord);
    const distToEnd = haversineKm(busPos, routeWaypoints[activeSegIdx + 1].coord);

    let currentStopIdx = activeSegIdx + 1;
    if (distToStart < 1.5) {
      currentStopIdx = activeSegIdx;
    } else if (distToEnd < 1.5) {
      currentStopIdx = activeSegIdx + 1;
    }

    // B. Map statuses and calculate ETAs
    return routeWaypoints.map((wp, idx) => {
      let status = "upcoming";
      let eta = "";

      if (idx < currentStopIdx) {
        status = "passed";
        eta = "✓ Passed";
      } else if (idx === currentStopIdx) {
        status = "current";
        const dist = haversineKm(busPos, wp.coord);
        eta = formatETA(dist, loc?.speed);
      } else {
        status = "upcoming";
        // Cumulative distance from currentStop to upcoming stop
        let distance = haversineKm(busPos, routeWaypoints[currentStopIdx].coord);
        for (let j = currentStopIdx; j < idx; j++) {
          distance += haversineKm(routeWaypoints[j].coord, routeWaypoints[j + 1].coord);
        }
        eta = formatETA(distance, loc?.speed);
      }

      return {
        ...wp,
        status,
        eta,
      };
    });
  }, [routeWaypoints, busPos, loc]);

  // Total trip ETA to the destination
  const tripETA = useMemo(() => {
    if (!busPos || stopsStatusAndETA.length === 0) return "Not Started";
    const destStop = stopsStatusAndETA[stopsStatusAndETA.length - 1];
    if (destStop.status === "passed" || destStop.eta === "Reached") return "Reached";
    return destStop.eta;
  }, [busPos, stopsStatusAndETA]);

  // ── Smart Geolocation and Distance matching for Passenger ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPassengerPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoError(null);
      },
      (err) => {
        setGeoError("Unable to retrieve location. Please allow location access.");
      },
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!passengerPos || routeWaypoints.length === 0) return;

    let minDistance = Infinity;
    let closestWp = null;

    for (const wp of routeWaypoints) {
      const dist = haversineKm(passengerPos, wp.coord);
      if (dist < minDistance) {
        minDistance = dist;
        closestWp = wp;
      }
    }

    setNearestStop({ name: closestWp.name, distance: minDistance });

    // Enable button within 20 km (20.0 km)
    if (minDistance <= 20.0) {
      setCurrentStopName(closestWp.name);
      setIsNearStop(true);
    } else {
      setCurrentStopName(null);
      setIsNearStop(false);
    }
  }, [passengerPos, routeWaypoints]);

  const handleSendRequest = async () => {
    if (!isNearStop || !currentStopName) return;
    try {
      const res = await createPickupRequest(busId, passengerId, currentStopName);
      setActiveRequest(res);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send pickup request");
    }
  };

  const handleCancelRequest = async () => {
    try {
      const res = await cancelPickupRequest(busId, passengerId);
      setActiveRequest(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel pickup request");
    }
  };

  if (!bus) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
        <p className="muted">Loading bus details…</p>
      </div>
    );
  }

  const availabilityStatus = bus.availabilityStatus ?? getAvailabilityStatus(bus);
  const lastUpdate = loc?.lastUpdated ? new Date(loc.lastUpdated).toLocaleString() : "Never";
  const markerPositions = routeWaypoints.map((wp) => wp.coord);
  const polylinePositions = roadGeometry.length > 0 ? roadGeometry : markerPositions;
  const allPositions = busPos ? [...markerPositions, busPos] : markerPositions;

  return (
    <>
      {/* Navigation Back Link */}
      <Link to="/all-buses" className="back-link">&larr; Back to Live Map</Link>

      {/* Header Panel */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 className="bus-title">{bus.busNumber}</h1>
            <AvailabilityBadge status={availabilityStatus} size="lg" />
          </div>
          <p className="route-subtitle">{route?.routeName}</p>
        </div>
      </div>

      {/* Grid of details */}
      <div className="details-grid">
        {/* Card 1: Trip ETA */}
        <div className="detail-card eta-card">
          <span className="label">Overall ETA</span>
          <div className="value">{tripETA}</div>
          <div className="subtext">Estimated time remaining</div>
        </div>

        {/* Card 2: Bus Operator */}
        <div className="detail-card">
          <span className="label">Bus Operator</span>
          <div className="value">{bus.busBrand}</div>
          <div className="subtext" style={{ textTransform: "capitalize" }}>{bus.busType} Service</div>
        </div>

        {/* Card 3: Driver Details */}
        <div className="detail-card driver-card">
          <span className="label">Driver Details</span>
          <div className="value">{bus.driverId?.name || "—"}</div>
          <div className="subtext">Verified Driver</div>
        </div>

        {/* Card 4: Live Status */}
        <div className="detail-card">
          <span className="label">Live Status</span>
          <div className="value" style={{ display: "flex", alignItems: "center" }}>
            <AvailabilityBadge status={availabilityStatus} />
          </div>
          <div className="subtext">
            {availabilityStatus === "running" && (loc?.speed ? `${(loc.speed * 3.6).toFixed(0)} km/h` : "Active")}
            {availabilityStatus === "offline"  && "Offline"}
            {availabilityStatus === "inactive" && "No service today"}
          </div>
        </div>
      </div>

      {/* Smart Pickup Request Panel */}
      <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--violet)" }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <h2 style={{ fontSize: "20px", margin: 0, fontWeight: 800, color: "var(--ink)" }}>Smart Pickup Request</h2>
        </div>

        {geoError ? (
          <div style={{ padding: "14px", background: "rgba(239, 68, 68, 0.08)", color: "var(--coral)", borderRadius: "12px", fontSize: "14px", fontWeight: 600 }}>
            {geoError}
          </div>
        ) : !passengerPos ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--ink-muted)" }}>
            <div className="spinner" style={{ width: "18px", height: "18px", border: "2.5px solid rgba(123, 44, 191, 0.2)", borderTopColor: "var(--violet)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Acquiring your GPS location…</span>
          </div>
        ) : (
          <div>
            {activeRequest ? (
              <div style={{ background: "rgba(123, 44, 191, 0.04)", padding: "20px", borderRadius: "16px", border: "1.5px solid rgba(123, 44, 191, 0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <span className="label" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "var(--ink-muted)", letterSpacing: "0.5px" }}>Pickup Status</span>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--violet)", marginTop: "4px" }}>
                      {{
                        sent: "Request Sent",
                        accepted: "Request Accepted",
                        rejected: "Request Rejected",
                        approaching: "Driver Approaching",
                        arrived: "Bus Arrived",
                        completed: "Pickup Completed",
                        full: "Bus Full",
                        passed: "Bus Passed Stop",
                        cancelled: "Pickup Cancelled"
                      }[activeRequest.status] || activeRequest.status}
                    </div>
                  </div>
                  <span style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    marginTop: "8px",
                    display: "inline-block",
                    background: {
                      sent: "var(--violet)",
                      accepted: "#16a34a",
                      rejected: "var(--coral)",
                      approaching: "#FF7B00",
                      arrived: "#2563eb",
                      completed: "#16a34a",
                      full: "#FF7B00",
                      passed: "#6b7280",
                      cancelled: "var(--coral)"
                    }[activeRequest.status] || "var(--violet)"
                  }} />
                </div>
                <p style={{ fontSize: "14px", margin: "0 0 16px 0", color: "var(--ink-secondary)", lineHeight: "1.5" }}>
                  Your pickup request at <strong>{activeRequest.stopName}</strong> is updated in real time.
                </p>

                {["sent", "accepted", "approaching", "arrived"].includes(activeRequest.status) && (
                  <button
                    onClick={handleCancelRequest}
                    className="btn"
                    style={{ background: "var(--coral)", padding: "10px 20px", fontSize: "13px", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            ) : (
              <div>
                {availabilityStatus !== "running" ? (
                  <div style={{ padding: "14px", background: "rgba(156, 163, 175, 0.08)", borderRadius: "12px", fontSize: "14px", color: "var(--ink-muted)", fontWeight: 600 }}>
                    Pickup requests are only available when the bus is actively running.
                  </div>
                ) : bus.isFull || !bus.acceptingRequests ? (
                  <div style={{ padding: "18px", background: "rgba(249, 115, 22, 0.08)", color: "#ea6c00", borderRadius: "16px", border: "1.5px solid rgba(249, 115, 22, 0.15)" }}>
                    <div style={{ fontWeight: 800, marginBottom: "6px", fontSize: "16px" }}>Bus is Currently Full</div>
                    <div style={{ fontSize: "13.5px", lineHeight: "1.4" }}>The driver is temporarily not accepting pickup requests. The Request button will be re-enabled once seats are available.</div>
                  </div>
                ) : isNearStop ? (
                  <div style={{ background: "rgba(22, 163, 74, 0.04)", padding: "20px", borderRadius: "16px", border: "1.5px solid rgba(22, 163, 74, 0.15)" }}>
                    <div style={{ color: "#16a34a", fontWeight: 800, fontSize: "18px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      Reached Stop: {currentStopName}!
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--ink-secondary)", margin: "0 0 16px 0", lineHeight: "1.4" }}>
                      You are within the allowed 20 km radius of <strong>{currentStopName}</strong> stop (distance: <strong>{(nearestStop.distance).toFixed(2)} km</strong>).
                    </p>
                    <button
                      onClick={handleSendRequest}
                      className="btn"
                      style={{ background: "var(--violet)", padding: "12px 24px", fontSize: "14px", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Request Pickup
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "rgba(107, 114, 128, 0.04)", padding: "20px", borderRadius: "16px", border: "1.5px solid rgba(107, 114, 128, 0.1)" }}>
                    <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--ink)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                      Navigate to Pickup Stop
                    </div>
                    <p style={{ fontSize: "13.5px", color: "var(--ink-muted)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                      You must be within 20 km of a valid bus stop on this route to request a pickup.
                    </p>
                    {nearestStop && (
                      <div style={{ fontSize: "13.5px", color: "var(--ink-secondary)", fontWeight: 600 }}>
                        Nearest stop: <strong style={{ color: "var(--violet)" }}>{nearestStop.name}</strong> (<strong>{(nearestStop.distance).toFixed(2)} km</strong> away)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Map */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <div className="map" style={{ border: "none", borderRadius: 0 }}>
          <MapContainer center={busPos || PUNJAB_CENTER} zoom={busPos ? 13 : 8} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {allPositions.length > 1 && <FitBounds positions={allPositions} />}

            {/* Polyline Route */}
            {polylinePositions.length > 1 && (
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: "var(--violet)",
                  weight: 5,
                  opacity: 0.75,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />
            )}

            {/* Route Stops Markers */}
            {routeWaypoints.map((wp, idx) => (
              <Marker
                key={`stop-marker-${idx}`}
                position={wp.coord}
                icon={wp.type === "endpoint" ? endpointIcon : stopIcon}
              >
                <Popup>
                  <div style={{ fontFamily: "var(--font-body)" }}>
                    <strong>{wp.name}</strong><br />
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      {wp.type === "endpoint" ? "Start / End Endpoint" : "Bus Stop"}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Bus Marker */}
            {busPos && (
              <Marker position={busPos} icon={makeBusIcon(availabilityStatus, loc?.heading)}>
                <Popup>
                  <div style={{ fontFamily: "var(--font-body)" }}>
                    <strong>{bus.busNumber}</strong><br />
                    <span>Speed: {loc?.speed ? `${(loc.speed * 3.6).toFixed(1)} km/h` : "Stationary"}</span><br />
                    <br />
                    <AvailabilityBadge status={availabilityStatus} />
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>

      {/* Route Stops Timeline */}
      <div className="route-stops-panel" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: "24px", marginBottom: "16px" }}>Route Stop Progress</h2>

        {/* Contextual notice for non-running states */}
        {availabilityStatus === "inactive" && (
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "rgba(156,163,175,.12)", borderRadius: "14px",
            padding: "16px 20px", marginBottom: "24px",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong style={{ color: "#6b7280" }}>Not Running Today</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                This bus has not sent any GPS updates today. Stop times below are estimates only.
              </div>
            </div>
          </div>
        )}
        {availabilityStatus === "offline" && (
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "rgba(249,115,22,.08)", borderRadius: "14px",
            padding: "16px 20px", marginBottom: "24px",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong style={{ color: "#ea6c00" }}>Offline — Operated Today</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                Last GPS ping: {lastUpdate}. The bus ran today but is currently not transmitting. Stop ETAs are based on the last known location.
              </div>
            </div>
          </div>
        )}

        <div className="stops-timeline">
          {stopsStatusAndETA.map((stop, idx) => {
            const isPassed = stop.status === "passed";
            const isCurrent = stop.status === "current";
            const isUpcoming = stop.status === "upcoming";

            // Determine status badge/text
            let statusLabel = "";
            let statusIcon = "🟢";
            let statusColor = "var(--ink-muted)";
            let dotColor = "rgba(16, 185, 129, 0.4)"; // default upcoming green

            if (isPassed) {
              statusLabel = "Passed";
              statusIcon = "";
              statusColor = "var(--green)";
              dotColor = "rgba(16, 185, 129, 0.2)";
            } else if (isCurrent) {
              statusLabel = "Current Stop";
              statusIcon = "";
              statusColor = "var(--violet)";
              dotColor = "rgba(123, 44, 191, 0.3)";
            } else if (isUpcoming) {
              statusLabel = "Upcoming Stop";
              statusIcon = "";
              statusColor = "var(--ink-muted)";
              dotColor = "rgba(16, 185, 129, 0.4)";
            }

            return (
              <div
                key={`stop-timeline-${idx}`}
                className={`stop-item ${isCurrent ? "active-stop" : ""}`}
                style={{
                  padding: "20px 0",
                  opacity: isPassed ? 0.6 : 1,
                  background: isCurrent ? "rgba(123, 44, 191, 0.03)" : "none",
                  borderRadius: "16px",
                  margin: "4px 0",
                  paddingRight: "16px",
                }}
              >
                {/* Visual Dot on Timeline */}
                <div
                  className="stop-dot"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isCurrent ? "var(--violet)" : isPassed ? "#10b981" : "#fff",
                    border: isUpcoming ? "3px solid #10b981" : "none",
                    boxShadow: `0 0 0 6px ${dotColor}`,
                    color: isCurrent || isPassed ? "#fff" : "#10b981",
                    fontSize: isPassed ? "11px" : "12px",
                    fontWeight: "bold",
                    width: "24px",
                    height: "24px",
                    left: "-43px",
                  }}
                >
                  {isPassed ? "✓" : ""}
                </div>

                {/* Stop Metadata */}
                <div className="stop-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{
                      fontSize: "18px",
                      color: isCurrent ? "var(--violet)" : "var(--ink)",
                      textDecoration: isPassed ? "line-through" : "none",
                    }}>
                      {stop.name}
                    </strong>
                    <div style={{ fontSize: "13px", color: statusColor, fontWeight: 700, marginTop: "4px" }}>
                      {statusLabel}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "12px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      ETA
                    </div>
                    <strong style={{
                      fontSize: "16px",
                      color: isCurrent ? "var(--violet)" : isPassed ? "var(--ink-muted)" : "var(--coral)",
                    }}>
                      {stop.eta}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
