import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getBuses } from "../services/api";
import { CITY_COORDS, haversineKm, formatETA, getAvailabilityStatus } from "../services/utils";
import AvailabilityBadge from "../components/AvailabilityBadge";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";
const socket = io(SOCKET_URL);

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PUNJAB_CENTER = [31.1471, 75.3412];

// Build a colour-coded DivIcon for each availability state
function makeBusIcon(availabilityStatus, heading) {
  const hasHeading = typeof heading === "number" && heading >= 0;

  const palette = {
    running:  { bg: "#16a34a", ring: true,  ringAnim: "bus-ping",    opacity: 1 },
    offline:  { bg: "#f97316", ring: false, ringAnim: "",             opacity: 1 },
    inactive: { bg: "#9ca3af", ring: false, ringAnim: "",             opacity: 0.55 },
  }[availabilityStatus] ?? { bg: "#9ca3af", ring: false, ringAnim: "", opacity: 0.55 };

  const arrowSvg = hasHeading && availabilityStatus !== "inactive"
    ? `<div style="
        position:absolute;top:-9px;left:50%;
        transform:translateX(-50%) rotate(${heading}deg);
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-bottom:10px solid ${palette.bg};
        z-index:2;"></div>`
    : "";

  const ringHtml = palette.ring
    ? `<div style="
        position:absolute;inset:-3px;border-radius:50%;
        border:2.5px solid ${palette.bg};
        animation:${palette.ringAnim} ${palette.ringAnim === "offline-ping" ? "1.8" : "1.2"}s ease-out infinite;
        z-index:0;"></div>`
    : "";

  return new L.DivIcon({
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      ${arrowSvg}
      ${ringHtml}
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:${palette.bg};border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.22);
        display:flex;align-items:center;justify-content:center;
        position:relative;z-index:1;
        opacity:${palette.opacity};">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 20H7v1a1 1 0 01-2 0v-1H4v-8H3V8h1V5a2 2 0 012-2h12a2 2 0 012 2v3h1v4h-1v8h-1v1a1 1 0 01-2 0v-1zM5 5v9h14V5H5zm0 11v2h4v-2H5zm10 0v2h4v-2h-4z"/>
        </svg>
      </div>
    </div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Auto-invalidate map size once it mounts (fixes blank tile issue in flex layouts)
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

// ── STATUS FILTER CHIP ────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px",
        borderRadius: 100,
        border: `1.5px solid ${active ? "var(--violet)" : "rgba(0,0,0,0.12)"}`,
        background: active ? "var(--violet)" : "#fff",
        color: active ? "#fff" : "var(--ink-secondary)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.18s ease",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-body)",
      }}
    >
      {label}
    </button>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AllBusesMap() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    running: false, offline: false, inactive: false,
    nearby: false, ac: false, nonAc: false,
    roadways: false, prtc: false,
  });
  const navigate = useNavigate();

  // Optional user location for "Near Me" chip
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // Fetch + live socket
  useEffect(() => {
    let cancelled = false;
    getBuses()
      .then((d) => { if (!cancelled) { setBuses(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });

    const handleUpdate = (upd) =>
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b._id === upd._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], currentLocation: upd.currentLocation, tripStarted: upd.tripStarted, availabilityStatus: upd.availabilityStatus };
        return next;
      });

    socket.on("busLocationUpdate", handleUpdate);
    return () => { cancelled = true; socket.off("busLocationUpdate", handleUpdate); };
  }, []);

  const toggleFilter = (key) =>
    setActiveFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "ac"    && next.ac)    next.nonAc = false;
      if (key === "nonAc" && next.nonAc) next.ac    = false;
      return next;
    });

  // Annotate buses with availability status, ETA, distance
  const annotatedBuses = useMemo(() =>
    buses.map((bus) => {
      const availabilityStatus = bus.availabilityStatus ?? getAvailabilityStatus(bus);
      const isAC = bus.busNumber.charCodeAt(bus.busNumber.length - 1) % 2 === 0;

      let eta = "—";
      if (availabilityStatus !== "inactive" && bus.currentLocation?.latitude && bus.routeId) {
        const dest = CITY_COORDS[bus.routeId.destination];
        if (dest) {
          const dist = haversineKm([bus.currentLocation.latitude, bus.currentLocation.longitude], dest);
          eta = formatETA(dist, bus.currentLocation?.speed);
        }
      }

      const distFromUser =
        userLocation && bus.currentLocation?.latitude != null
          ? haversineKm(
              [userLocation.latitude, userLocation.longitude],
              [bus.currentLocation.latitude, bus.currentLocation.longitude]
            )
          : null;

      return { ...bus, availabilityStatus, isAC, eta, distFromUser };
    }),
  [buses, userLocation]);

  // Apply search + chips
  const filteredBuses = useMemo(() => {
    const { running, offline, inactive, nearby, ac, nonAc, roadways, prtc } = activeFilters;
    const anyStatus = running || offline || inactive;

    return annotatedBuses.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          b.busNumber?.toLowerCase().includes(q) ||
          b.routeId?.routeName?.toLowerCase().includes(q) ||
          b.routeId?.source?.toLowerCase().includes(q) ||
          b.routeId?.destination?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (anyStatus && !activeFilters[b.availabilityStatus]) return false;
      if (ac    && !b.isAC) return false;
      if (nonAc &&  b.isAC) return false;
      if (roadways && b.busBrand !== "Punjab Roadways") return false;
      if (prtc     && b.busBrand !== "PRTC")            return false;
      if (nearby) {
        if (b.distFromUser === null || b.distFromUser > 5 || b.availabilityStatus !== "running") return false;
      }
      return true;
    });
  }, [annotatedBuses, searchQuery, activeFilters]);

  const counts = useMemo(() => ({
    running:  filteredBuses.filter((b) => b.availabilityStatus === "running").length,
    offline:  filteredBuses.filter((b) => b.availabilityStatus === "offline").length,
    inactive: filteredBuses.filter((b) => b.availabilityStatus === "inactive").length,
  }), [filteredBuses]);

  const activeChipCount = Object.values(activeFilters).filter(Boolean).length;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }} className="all-buses-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>All Buses</h1>
          <span style={{
            fontSize: "12px",
            background: "var(--ink)",
            color: "var(--lime)",
            padding: "4px 10px",
            borderRadius: "100px",
            fontWeight: "700"
          }}>{filteredBuses.length} Buses</span>
          {counts.running > 0 && (
            <div className="live-indicator" style={{ marginLeft: 4 }}>
              <div className="live-dot" /> Live Now
            </div>
          )}
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Live bus network across Punjab
        </p>
      </div>

      {/* ── Main split-pane ── */}
      <div className="all-buses-grid">

        {/* ── Right panel: map ── */}
        <div className="map-area responsive-map-container" style={{
          borderRadius: 24, overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
          border: "3px solid #fff",
          height: 640,
          position: "sticky",
          top: 100,
        }}>
          <MapContainer
            center={PUNJAB_CENTER}
            zoom={8}
            style={{ height: "100%", width: "100%" }}
          >
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {filteredBuses
              .filter((b) => b.currentLocation?.latitude != null && b.currentLocation?.longitude != null)
              .map((b) => (
                <Marker
                  key={b._id}
                  position={[b.currentLocation.latitude, b.currentLocation.longitude]}
                  icon={makeBusIcon(b.availabilityStatus, b.currentLocation?.heading)}
                  eventHandlers={{
                    click: () => b.availabilityStatus !== "inactive" && navigate(`/buses/${b._id}`),
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: "var(--font-body)", minWidth: 170 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{b.busNumber}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 2 }}>{b.busBrand} · {b.isAC ? "AC" : "Non-AC"}</div>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>{b.routeId?.routeName || "—"}</div>
                      <AvailabilityBadge status={b.availabilityStatus} />
                      {b.availabilityStatus === "inactive" && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>No service today</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          {/* Stats overlay */}
          <div style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 1000,
            background: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)",
            padding: "12px 18px", borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            display: "flex", gap: 18,
            border: "1px solid rgba(255,255,255,.6)",
          }}>
            {[
              { label: "Running",  value: counts.running,  color: "#16a34a" },
              { label: "Offline",  value: counts.offline,  color: "#f97316" },
              { label: "Inactive", value: counts.inactive, color: "#9ca3af" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ textAlign: "center", paddingRight: i < arr.length - 1 ? 18 : 0,
                borderRight: i < arr.length - 1 ? "1px solid rgba(0,0,0,.08)" : "none" }}>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search area ── */}
        <div className="search-area">
          {/* Search + filter toggle row */}
          <div style={{ display: "flex", gap: 8 }}>
            {/* Search box */}
            <div style={{ position: "relative", flex: 1 }}>
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search bus, route, city…"
                value={searchQuery}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "");
                  setSearchQuery(sanitized);
                }}
                style={{
                  paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
                  fontSize: 14, borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)",
                  background: "#fff", width: "100%", outline: "none", fontFamily: "var(--font-body)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              />
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", borderRadius: 12, cursor: "pointer",
                border: `1.5px solid ${activeChipCount > 0 ? "var(--violet)" : "rgba(0,0,0,0.12)"}`,
                background: activeChipCount > 0 ? "var(--violet)" : "#fff",
                color: activeChipCount > 0 ? "#fff" : "var(--ink-secondary)",
                fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                fontFamily: "var(--font-body)", transition: "all 0.18s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filters{activeChipCount > 0 ? ` (${activeChipCount})` : ""}
            </button>
          </div>

          {/* Collapsible filter chips */}
          {filtersOpen && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "14px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.5px", color: "var(--ink-muted)", marginBottom: 10 }}>
                Status
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                <Chip label="Running"          active={activeFilters.running}  onClick={() => toggleFilter("running")} />
                <Chip label="Offline Today"    active={activeFilters.offline}  onClick={() => toggleFilter("offline")} />
                <Chip label="Not Running Today" active={activeFilters.inactive} onClick={() => toggleFilter("inactive")} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.5px", color: "var(--ink-muted)", marginBottom: 10 }}>
                More Filters
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip label="Near Me (&lt;5 km)"  active={activeFilters.nearby}   onClick={() => toggleFilter("nearby")} />
                <Chip label="AC"                  active={activeFilters.ac}       onClick={() => toggleFilter("ac")} />
                <Chip label="Non-AC"              active={activeFilters.nonAc}    onClick={() => toggleFilter("nonAc")} />
                <Chip label="Punjab Roadways"     active={activeFilters.roadways} onClick={() => toggleFilter("roadways")} />
                <Chip label="PRTC"                active={activeFilters.prtc}     onClick={() => toggleFilter("prtc")} />
              </div>
              {activeChipCount > 0 && (
                <button
                  onClick={() => setActiveFilters({ running: false, offline: false, inactive: false, nearby: false, ac: false, nonAc: false, roadways: false, prtc: false })}
                  style={{ marginTop: 12, fontSize: 12, color: "var(--coral)", fontWeight: 700,
                    background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-body)" }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Bus list area ── */}
        <div className="list-area" style={{ maxHeight: "66vh", overflowY: "auto", paddingRight: 4 }}>
          {loading ? (
            <p className="muted" style={{ textAlign: "center", padding: "32px 0" }}>Loading buses…</p>
          ) : filteredBuses.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
              <p className="muted">No buses match these filters.</p>
            </div>
          ) : filteredBuses.map((b) => {
            const isInactive = b.availabilityStatus === "inactive";
            const isRunning = b.availabilityStatus === "running";
            return (
              <div
                key={b._id}
                className={`bus-item${isInactive ? " bus-inactive" : ""}${isRunning ? " bus-running" : ""}`}
                onClick={() => !isInactive && navigate(`/buses/${b._id}`)}
                style={{ padding: "14px 16px", marginBottom: 10 }}
              >
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800,
                      background: isRunning ? "rgba(16,185,129,.15)" : "rgba(123,44,191,.1)",
                      color: isRunning ? "#059669" : "var(--violet)",
                      padding: "3px 8px", borderRadius: 6, fontFamily: "var(--font-display)",
                    }}>
                      {b.busNumber}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)" }}>
                      {b.isAC ? "AC" : "Non-AC"}
                    </span>
                  </div>
                  {isInactive
                    ? <span className="inactive-ribbon">Not Running Today</span>
                    : <AvailabilityBadge status={b.availabilityStatus} />
                  }
                </div>

                {/* Route name */}
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: "var(--ink)" }}>
                  {b.routeId?.routeName || "Unnamed Route"}
                </div>

                {/* Source → Destination */}
                {b.routeId?.source && (
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 8 }}>
                    {b.routeId.source} &rarr; {b.routeId.destination}
                  </div>
                )}

                {/* Stats + action */}
                {!isInactive && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div>
                        <span style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 700 }}>ETA</span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: b.availabilityStatus === "running" ? "var(--coral)" : "var(--ink-muted)" }}>
                          {b.eta}
                        </div>
                      </div>
                      {b.distFromUser !== null && (
                        <div>
                          <span style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: 700 }}>Distance</span>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{b.distFromUser.toFixed(1)} km</div>
                        </div>
                      )}
                    </div>
                    <button
                      className="btn"
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, boxShadow: "none" }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/buses/${b._id}`); }}
                    >
                      {b.availabilityStatus === "running" ? "Track" : "Details"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .grid-responsive-layout { grid-template-columns: 1fr !important; }
        }
        @keyframes bus-ping {
          0%   { transform: scale(1); opacity: .85; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes offline-ping {
          0%   { transform: scale(1); opacity: .7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>
    </>
  );
}
