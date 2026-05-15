import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBus } from "../services/api";

export default function BusDetails() {
  const { busId } = useParams();
  const [bus, setBus] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => getBus(busId).then((b) => !stop && setBus(b));
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, [busId]);

  if (!bus) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
        <p className="muted">Loading bus details…</p>
      </div>
    );
  }

  const last = bus.currentLocation?.lastUpdated
    ? new Date(bus.currentLocation.lastUpdated).toLocaleString()
    : "Never";

  return (
    <>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>{bus.busNumber}</h1>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span className={`badge ${bus.busType === "government" ? "gov" : "priv"}`}>{bus.busType}</span>
            <span className={`badge ${bus.status === "active" ? "active" : "offline"}`}>{bus.status}</span>
          </div>
        </div>
        {bus.status === "active" && (
          <div className="live-indicator" style={{ marginTop: 6 }}>
            <div className="live-dot"></div>
            Live
          </div>
        )}
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Brand
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{bus.busBrand}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Driver
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{bus.driverId?.name || "—"}</div>
          <div className="muted">{bus.driverId?.phone}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Route
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 4 }}>{bus.routeId?.routeName}</div>
        <div className="muted">via {bus.routeId?.stops?.join(", ")}</div>
      </div>

      <div className="muted" style={{ marginBottom: 16 }}>
        Last location update: {last}
      </div>

      <Link to={`/buses/${bus._id}/track`} className="btn" style={{ width: "100%", justifyContent: "center" }}>
        Track live on map →
      </Link>
    </>
  );
}
