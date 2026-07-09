import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBusesByRoute } from "../services/api";
import { getAvailabilityStatus } from "../services/utils";
import AvailabilityBadge from "../components/AvailabilityBadge";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";
const socket = io(SOCKET_URL);

export default function BusListing() {
  const { routeId } = useParams();
  const [buses, setBuses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getBusesByRoute(routeId).then((d) => setBuses(d)).catch(console.error);

    const handleLocationUpdate = (updatedBus) => {
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b._id === updatedBus._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          currentLocation:    updatedBus.currentLocation,
          tripStarted:        updatedBus.tripStarted,
          availabilityStatus: updatedBus.availabilityStatus, // from backend computeStatus
        };
        return next;
      });
    };

    socket.on("busLocationUpdate", handleLocationUpdate);
    return () => socket.off("busLocationUpdate", handleLocationUpdate);
  }, [routeId]);

  // Annotate each bus with a client-computed availability status
  const annotated = buses.map((b) => ({
    ...b,
    _avail: b.availabilityStatus ?? getAvailabilityStatus(b),
  }));

  const runningCount  = annotated.filter((b) => b._avail === "running").length;
  const offlineCount  = annotated.filter((b) => b._avail === "offline").length;
  const inactiveCount = annotated.filter((b) => b._avail === "inactive").length;

  return (
    <>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Buses on Route</h1>
          {buses.length > 0 && (
            <p className="muted">
              {runningCount} running · {offlineCount} offline today · {inactiveCount} inactive today — live updates
            </p>
          )}
        </div>
        {runningCount > 0 && (
          <div className="live-indicator" style={{ marginTop: 6 }}>
            <div className="live-dot" />
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

      {annotated.map((b) => {
        const isInactive = b._avail === "inactive";
        const isRunning = b._avail === "running";
        return (
          <div
            key={b._id}
            className={`bus-item${isInactive ? " bus-inactive" : ""}${isRunning ? " bus-running" : ""}`}
            onClick={() => !isInactive && navigate(`/buses/${b._id}`)}
            title={isInactive ? "This bus has not operated today" : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Bus type icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: b.busType === "government"
                    ? "rgba(123,44,191,0.1)"
                    : "rgba(255,94,0,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                  filter: isInactive ? "grayscale(1)" : "none",
                }}>
                  {b.busType === "government" ? "🏛️" : "🚐"}
                </div>

                <div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    background: isRunning ? "rgba(16,185,129,.15)" : "rgba(123,44,191,.1)",
                    color: isRunning ? "#059669" : "var(--violet)",
                    padding: "3px 8px", borderRadius: 6, fontFamily: "var(--font-display)",
                    marginRight: 8, display: "inline-block"
                  }}>
                    {b.busNumber}
                  </span>
                  <span className="muted">{b.busBrand}</span>
                  <div className="muted" style={{ marginTop: 2 }}>
                    Driver: {b.driverId?.name || "—"}
                  </div>
                </div>
              </div>

              {/* Availability status */}
              {isInactive
                ? <span className="inactive-ribbon">Not Running Today</span>
                : <AvailabilityBadge status={b._avail} />
              }
            </div>
          </div>
        );
      })}
    </>
  );
}
