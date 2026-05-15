import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getBus } from "../services/api";

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
  "Bhikhi": [30.0488, 75.5350],
  "Mehal Kalan": [30.3290, 75.6630],
  "Raikot": [30.6520, 75.6070],
  "Dinanagar": [32.1392, 75.4678],
  "Kartarpur": [31.4440, 75.5006],
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

const busIcon = new L.DivIcon({
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #16a34a; border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    display: flex; align-items: center; justify-content: center;
  "><span style="font-size: 14px;">🚌</span></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

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

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

export default function LiveTracking() {
  const { busId } = useParams();
  const [bus, setBus] = useState(null);
  const [roadGeometry, setRoadGeometry] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => getBus(busId).then((b) => !stop && setBus(b)).catch(console.error);
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, [busId]);

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
        {bus?.status === "active" && (
          <div className="live-indicator" style={{ marginTop: 6 }}>
            <div className="live-dot"></div>
            Live
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="map" style={{ border: "none", borderRadius: 0 }}>
        <MapContainer center={busPos || PUNJAB_CENTER} zoom={hasLoc ? 13 : 8} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {allPositions.length > 1 && <FitBounds positions={allPositions} />}

          {polylinePositions.length > 1 && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: "#0d9488",
                weight: 4,
                opacity: 0.85,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          )}

          {routeWaypoints.map((wp, i) => (
            <Marker
              key={`stop-${i}`}
              position={wp.coord}
              icon={wp.type === "endpoint" ? endpointIcon : stopIcon}
            >
              <Popup>
                <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <strong>{wp.name}</strong><br />
                  <span style={{ fontSize: 12, color: "#78716c" }}>{wp.type === "endpoint" ? "Start / End" : "Stop"}</span>
                </div>
              </Popup>
            </Marker>
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
