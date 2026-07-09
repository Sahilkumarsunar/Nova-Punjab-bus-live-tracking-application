import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getBuses } from "../services/api";
import { haversineKm, formatETA, getAvailabilityStatus, CITY_COORDS } from "../services/utils";
import AvailabilityBadge from "../components/AvailabilityBadge";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";
const socket = io(SOCKET_URL);

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

// ── Icons ──────────────────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Pulsing "You are here" user marker
const userIcon = new L.DivIcon({
  html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(123,44,191,.15);animation:user-pulse 1.8s ease-out infinite;"></div>
    <div style="width:18px;height:18px;border-radius:50%;background:var(--violet,#7B2CBF);border:3px solid #fff;box-shadow:0 2px 8px rgba(123,44,191,.5);position:relative;z-index:1;"></div>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function makeBusIcon(selected, availabilityStatus) {
  const isOffline = availabilityStatus === "offline";
  const bg = selected ? "#7B2CBF" : (isOffline ? "#f97316" : "#16a34a");
  const ring = selected
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid #7B2CBF;animation:bus-ping 1.2s ease-out infinite;z-index:0;"></div>`
    : (isOffline
      ? "" // Offline has no pulsing wave ring!
      : `<div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid #16a34a;animation:bus-ping 1.2s ease-out infinite;z-index:0;"></div>`);
  return new L.DivIcon({
    html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
      ${ring}
      <div style="width:28px;height:28px;border-radius:50%;background:${bg};border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 20H7v1a1 1 0 01-2 0v-1H4v-8H3V8h1V5a2 2 0 012-2h12a2 2 0 012 2v3h1v4h-1v8h-1v1a1 1 0 01-2 0v-1zM5 5v9h14V5H5zm0 11v2h4v-2H5zm10 0v2h4v-2h-4z"/>
        </svg>
      </div>
    </div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Fly map to selected bus or user location
function MapFocus({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 0.8 });
  }, [target, map]);
  return null;
}

// Invalidate size on mount (fixes blank tile in flex layout)
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 200);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function NearbyBuses() {
  const [buses, setBuses] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [radius, setRadius] = useState(5);
  const [loading, setLoading] = useState(true);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const popupRefs = useRef({});
  const navigate = useNavigate();

  // 1. Watch user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocationLoading(false);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationError(null);
        setLocationLoading(false);
      },
      () => {
        setLocationError("Please enable location permissions to find nearby buses.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Fetch buses + socket
  useEffect(() => {
    getBuses()
      .then((d) => setBuses(d))
      .catch(console.error)
      .finally(() => setLoading(false));

    const handleUpdate = (upd) =>
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b._id === upd._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], currentLocation: upd.currentLocation, tripStarted: upd.tripStarted, availabilityStatus: upd.availabilityStatus };
        return next;
      });

    socket.on("busLocationUpdate", handleUpdate);
    return () => socket.off("busLocationUpdate", handleUpdate);
  }, []);

  // 3. Filter + annotate nearby running buses
  const nearbyBuses = useMemo(() => {
    if (!userLocation) return [];
    return buses
      .map((bus) => {
        const availabilityStatus = bus.availabilityStatus ?? getAvailabilityStatus(bus);
        const hasLoc = bus.currentLocation?.latitude != null && bus.currentLocation?.longitude != null;
        const distance = hasLoc
          ? haversineKm([userLocation.latitude, userLocation.longitude], [bus.currentLocation.latitude, bus.currentLocation.longitude])
          : Infinity;
        const eta = hasLoc ? formatETA(distance, bus.currentLocation.speed) : "N/A";
        return { ...bus, availabilityStatus, distance, eta };
      })
      .filter((b) => b.availabilityStatus === "running" && b.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }, [buses, userLocation, radius]);

  const selectedBus = nearbyBuses.find((b) => b._id === selectedBusId) ?? null;

  // Calculate selected bus waypoints & geometry
  const selectedBusWaypoints = useMemo(() => {
    if (!selectedBus || !selectedBus.routeId) return [];
    const r = selectedBus.routeId;
    const points = [];
    const srcCoord = CITY_COORDS[r.source];
    if (srcCoord) points.push({ name: r.source, coord: srcCoord, type: "endpoint" });
    if (r.stops) {
      for (const st of r.stops) {
        const sc = CITY_COORDS[st];
        if (sc) points.push({ name: st, coord: sc, type: "stop" });
      }
    }
    const dstCoord = CITY_COORDS[r.destination];
    if (dstCoord) points.push({ name: r.destination, coord: dstCoord, type: "endpoint" });
    return points;
  }, [selectedBus]);

  const [selectedRouteGeometry, setSelectedRouteGeometry] = useState([]);

  useEffect(() => {
    if (selectedBusWaypoints.length < 2) {
      setSelectedRouteGeometry([]);
      return;
    }
    const coordsStr = selectedBusWaypoints.map((wp) => `${wp.coord[1]},${wp.coord[0]}`).join(";");
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?geometries=geojson&overview=full`)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const geom = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
          setSelectedRouteGeometry(geom);
        }
      })
      .catch((err) => {
        console.error("OSRM Route geometry error in NearbyBuses:", err);
        setSelectedRouteGeometry(selectedBusWaypoints.map((wp) => wp.coord));
      });
  }, [selectedBusWaypoints]);

  // Map focus target: selected bus, otherwise user location
  const mapFocusTarget = selectedBus
    ? [selectedBus.currentLocation.latitude, selectedBus.currentLocation.longitude]
    : userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : null;

  const mapCenter = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [31.1471, 75.3412];

  const retryLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocationError(null); setLocationLoading(false); },
      () => { setLocationError("Still unable to access location. Check system permissions."); setLocationLoading(false); }
    );
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Nearby Buses</h1>
          <p className="muted">Running buses within your selected radius</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {nearbyBuses.length > 0 && <div className="live-indicator"><div className="live-dot" />Live</div>}
          {userLocation && (
            <span className="bus-count-badge">{nearbyBuses.length} within {radius} km</span>
          )}
        </div>
      </div>

      {/* Radius chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-muted)", letterSpacing: "0.5px", marginRight: 4 }}>
          Radius
        </span>
        {[1, 2, 5, 10].map((r) => (
          <button
            key={r}
            onClick={() => setRadius(r)}
            style={{
              padding: "7px 18px", borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `1.5px solid ${radius === r ? "var(--violet)" : "rgba(0,0,0,0.12)"}`,
              background: radius === r ? "var(--violet)" : "#fff",
              color: radius === r ? "#fff" : "var(--ink-secondary)",
              transition: "all 0.18s", fontFamily: "var(--font-body)",
            }}
          >
            {r} km
          </button>
        ))}
      </div>

      {/* Location loading / error states */}
      {locationLoading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e7e5e4", borderTopColor: "var(--violet)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p className="muted">Requesting location access…</p>
        </div>
      )}

      {!locationLoading && locationError && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="1.5" style={{ margin: "0 auto 16px", display: "block" }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <h3 style={{ marginBottom: 8 }}>Location Access Required</h3>
          <p className="muted" style={{ maxWidth: 380, margin: "0 auto 24px" }}>{locationError}</p>
          <button className="btn" onClick={retryLocation}>Retry</button>
        </div>
      )}

      {/* Main content — split pane */}
      {!locationLoading && !locationError && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 20,
          alignItems: "start",
        }} className="grid-responsive-layout">

          {/* ── Left: bus list ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && (
              <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>Loading buses…</p>
            )}

            {!loading && nearbyBuses.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" style={{ margin: "0 auto 16px", display: "block" }}>
                  <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <h3 style={{ marginBottom: 8 }}>No Buses Nearby</h3>
                <p className="muted">No active buses within {radius} km. Try a larger radius.</p>
              </div>
            )}

            {!loading && nearbyBuses.map((bus) => {
              const isSelected = bus._id === selectedBusId;
              return (
                <div
                  key={bus._id}
                  onClick={() => setSelectedBusId(isSelected ? null : bus._id)}
                  style={{
                    background: "#fff", borderRadius: 16, padding: "16px 18px",
                    cursor: "pointer", transition: "all 0.2s",
                    border: `2px solid ${isSelected ? "var(--violet)" : "rgba(0,0,0,0.06)"}`,
                    boxShadow: isSelected ? "0 8px 24px rgba(123,44,191,.18)" : "0 2px 8px rgba(0,0,0,.05)",
                    transform: isSelected ? "translateY(-2px)" : "none",
                  }}
                >
                  {/* Row 1 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "3px 10px", background: isSelected ? "var(--violet)" : "rgba(123,44,191,.1)", color: isSelected ? "#fff" : "var(--violet)", borderRadius: 8, fontWeight: 800, fontSize: 13, fontFamily: "var(--font-display)" }}>
                        {bus.busNumber}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>{bus.busBrand}</span>
                    </div>
                    <AvailabilityBadge status={bus.availabilityStatus} />
                  </div>

                  {/* Route name */}
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {bus.routeId?.routeName || "Unnamed Route"}
                  </div>
                  {bus.routeId?.source && (
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 10 }}>
                      {bus.routeId.source} &rarr; {bus.routeId.destination}
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "var(--ink-muted)" }}>Distance</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--violet)" }}>{bus.distance.toFixed(2)} km</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "var(--ink-muted)" }}>ETA to You</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--coral)" }}>{bus.eta}</div>
                      </div>
                    </div>
                    <button
                      className="btn"
                      style={{ padding: "7px 16px", fontSize: 12, borderRadius: 8, boxShadow: "none" }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/buses/${bus._id}`); }}
                    >
                      Track
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right: Map ── */}
          <div className="responsive-map-container" style={{
            borderRadius: 24, overflow: "hidden",
            border: "3px solid #fff",
            boxShadow: "var(--shadow-lg)",
            height: 580,
            position: "sticky",
            top: 100,
          }}>
            <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
              <MapResizer />
              <MapFocus target={mapFocusTarget} />

              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              {/* ── User location marker ── */}
              {userLocation && (
                <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
                  <Popup>
                    <div style={{ fontFamily: "var(--font-body)", textAlign: "center", padding: "4px 8px" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Your Location</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* ── Radius circle ── */}
              {userLocation && (
                <Circle
                  center={[userLocation.latitude, userLocation.longitude]}
                  radius={radius * 1000}
                  pathOptions={{
                    color: "#7B2CBF",
                    fillColor: "#7B2CBF",
                    fillOpacity: 0.06,
                    weight: 1.5,
                    dashArray: "6 4",
                  }}
                />
              )}

              {/* ── Selected Bus Route & Stops ── */}
              {selectedBus && selectedRouteGeometry.length > 1 && (
                <Polyline
                  positions={selectedRouteGeometry}
                  pathOptions={{
                    color: "var(--violet)",
                    weight: 4,
                    opacity: 0.85,
                    lineJoin: "round",
                    lineCap: "round",
                  }}
                />
              )}

              {selectedBus && selectedBusWaypoints.map((wp, idx) => (
                <Marker
                  key={`route-stop-${idx}`}
                  position={wp.coord}
                  icon={wp.type === "endpoint" ? endpointIcon : stopIcon}
                >
                  <Popup>
                    <div style={{ fontFamily: "var(--font-body)", textAlign: "center", padding: "4px 8px" }}>
                      <strong style={{ color: "var(--violet)" }}>{wp.name}</strong>
                      <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "2px" }}>
                        {idx === 0 ? "Start Terminus" : idx === selectedBusWaypoints.length - 1 ? "End Destination" : "Bus Stop"}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* ── Nearby bus markers ── */}
              {nearbyBuses.map((bus) => (
                <Marker
                  key={bus._id}
                  position={[bus.currentLocation.latitude, bus.currentLocation.longitude]}
                  icon={makeBusIcon(bus._id === selectedBusId, bus.availabilityStatus || getAvailabilityStatus(bus))}
                  eventHandlers={{ click: () => setSelectedBusId(bus._id === selectedBusId ? null : bus._id) }}
                >
                  <Popup>
                    <div style={{ fontFamily: "var(--font-body)", minWidth: 180 }}>
                      {/* Bus number + brand */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ padding: "3px 10px", background: "var(--violet,#7B2CBF)", color: "#fff", borderRadius: 7, fontWeight: 800, fontSize: 13 }}>
                          {bus.busNumber}
                        </span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{bus.busBrand}</span>
                      </div>
                      {/* Route */}
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                        {bus.routeId?.routeName || "Unnamed Route"}
                      </div>
                      {bus.routeId?.source && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                          {bus.routeId.source} → {bus.routeId.destination}
                        </div>
                      )}
                      {/* Stats */}
                      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#9ca3af" }}>Distance</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#7B2CBF" }}>{bus.distance.toFixed(2)} km</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#9ca3af" }}>ETA to You</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#FF5E00" }}>{bus.eta}</div>
                        </div>
                        {bus.currentLocation?.speed > 0 && (
                          <div>
                            <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#9ca3af" }}>Speed</div>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>{(bus.currentLocation.speed * 3.6).toFixed(0)} km/h</div>
                          </div>
                        )}
                      </div>
                      {/* Track button */}
                      <button
                        onClick={() => navigate(`/buses/${bus._id}`)}
                        style={{
                          width: "100%", padding: "8px", borderRadius: 8,
                          background: "#7B2CBF", color: "#fff", border: "none",
                          fontWeight: 700, fontSize: 13, cursor: "pointer",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        View Full Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map legend overlay */}
            <div style={{
              position: "absolute", bottom: 14, left: 14, zIndex: 1000,
              background: "rgba(255,255,255,.94)", backdropFilter: "blur(8px)",
              padding: "10px 14px", borderRadius: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,.1)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#7B2CBF", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(123,44,191,.4)" }} />
                Your Location
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#16a34a", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(22,163,74,.4)" }} />
                Active Bus
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151" }}>
                <div style={{ width: 20, height: 2, background: "#7B2CBF", borderRadius: 2, opacity: 0.5, borderTop: "2px dashed #7B2CBF" }} />
                Search Radius
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes user-pulse {
          0%   { transform: scale(1); opacity: .6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes bus-ping {
          0%   { transform: scale(1); opacity: .8; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @media (max-width: 860px) {
          .grid-responsive-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
