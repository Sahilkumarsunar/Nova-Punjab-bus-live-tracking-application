import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { getRoutes, getBusesByRoute } from "../services/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PUNJAB_CENTER = [31.1471, 75.3412];

const activeBusIcon = new L.DivIcon({
  html: `<div style="
    width: 30px; height: 30px; border-radius: 50%;
    background: #16a34a; border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    display: flex; align-items: center; justify-content: center;
  "><span style="font-size:14px;">🚌</span></div>`,
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const offlineBusIcon = new L.DivIcon({
  html: `<div style="
    width: 26px; height: 26px; border-radius: 50%;
    background: #a8a29e; border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    display: flex; align-items: center; justify-content: center;
  "><span style="font-size:12px;">🚌</span></div>`,
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export default function AllBusesMap() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let stop = false;
    const loadAll = async () => {
      try {
        const routes = await getRoutes();
        const allBuses = [];
        for (const route of routes) {
          try {
            const routeBuses = await getBusesByRoute(route._id);
            allBuses.push(...routeBuses);
          } catch (e) { /* skip */ }
        }
        if (!stop) { setBuses(allBuses); setLoading(false); }
      } catch (e) { console.error(e); if (!stop) setLoading(false); }
    };
    loadAll();
    const t = setInterval(loadAll, 15000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const activeBuses = buses.filter((b) => b.status === "active");
  const offlineBuses = buses.filter((b) => b.status !== "active");
  const locatedBuses = buses.filter(
    (b) => b.currentLocation?.latitude != null && b.currentLocation?.longitude != null
  );

  return (
    <>
      <div className="all-buses-header">
        <div>
          <h1>All buses</h1>
          <p className="muted">Live overview of every registered bus across Punjab</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeBuses.length > 0 && (
            <div className="live-indicator">
              <div className="live-dot"></div>
              Live
            </div>
          )}
          <span className="bus-count-badge">{buses.length} buses</span>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="stat-mini">
          <strong style={{ color: "var(--green)" }}>{activeBuses.length}</strong>
          <span>Active</span>
        </div>
        <div className="stat-mini">
          <strong style={{ color: "var(--red)" }}>{offlineBuses.length}</strong>
          <span>Offline</span>
        </div>
        <div className="stat-mini">
          <strong style={{ color: "var(--teal)" }}>{locatedBuses.length}</strong>
          <span>On map</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="map" style={{ height: 480, border: "none", borderRadius: 0 }}>
          <MapContainer center={PUNJAB_CENTER} zoom={8} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {locatedBuses.map((b) => (
              <Marker
                key={b._id}
                position={[b.currentLocation.latitude, b.currentLocation.longitude]}
                icon={b.status === "active" ? activeBusIcon : offlineBusIcon}
                eventHandlers={{ click: () => navigate(`/buses/${b._id}`) }}
              >
                <Popup>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 150 }}>
                    <strong>{b.busNumber}</strong><br />
                    <span style={{ fontSize: 12, color: "#78716c" }}>{b.busBrand}</span><br />
                    <span style={{ fontSize: 12, color: "#78716c" }}>Route: {b.routeId?.routeName || "—"}</span><br />
                    <span style={{ fontSize: 12, color: b.status === "active" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {b.status}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {loading && <p className="muted" style={{ textAlign: "center" }}>Loading buses…</p>}

      <div className="bus-legend" style={{ marginTop: 8 }}>
        <div className="legend-item"><div className="legend-dot active-dot"></div> Active</div>
        <div className="legend-item"><div className="legend-dot offline-dot"></div> Offline</div>
      </div>
    </>
  );
}
