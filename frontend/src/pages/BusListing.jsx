import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBusesByRoute } from "../services/api";

export default function BusListing() {
  const { routeId } = useParams();
  const [buses, setBuses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = () => getBusesByRoute(routeId).then((d) => !cancelled && setBuses(d)).catch(console.error);
    load();
    const t = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, [routeId]);

  const activeCount = buses.filter((b) => b.status === "active").length;

  return (
    <>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Buses on route</h1>
          {buses.length > 0 && (
            <p className="muted">
              {activeCount} active, {buses.length - activeCount} offline — updates every 10s
            </p>
          )}
        </div>
        {activeCount > 0 && (
          <div className="live-indicator" style={{ marginTop: 6 }}>
            <div className="live-dot"></div>
            Live
          </div>
        )}
      </div>

      {buses.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 14, color: "var(--ink-muted)" }}>
            No buses are registered on this route yet.
            <br />
            <span style={{ fontSize: 12 }}>Check back later or try another route.</span>
          </div>
        </div>
      )}

      {buses.map((b) => (
        <div key={b._id} className="bus-item" onClick={() => navigate(`/buses/${b._id}`)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: b.busType === "government" ? "var(--blue-light)" : "var(--amber-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0
              }}>
                {b.busType === "government" ? "🏛️" : "🚐"}
              </div>
              <div>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{b.busNumber}</strong>
                <span className="muted" style={{ marginLeft: 8 }}>{b.busBrand}</span>
                <div className="muted" style={{ marginTop: 2 }}>
                  Driver: {b.driverId?.name || "—"}
                </div>
              </div>
            </div>
            <span className={`badge ${b.status === "active" ? "active" : "offline"}`}>
              {b.status}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
