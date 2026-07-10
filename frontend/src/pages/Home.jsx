import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRoutes } from "../services/api";

export default function Home() {
  const [routeCount, setRouteCount] = useState(0);

  useEffect(() => {
    getRoutes().then((r) => setRouteCount(r.length)).catch(() => {});
  }, []);

  return (
    <>
      <div className="hero-section">
        <div className="hero-content">
          <h1>
            Track your bus &
            <br />
            request a <span className="highlight">smart pickup</span>
          </h1>
          <p>
            Nova combines real-time GPS tracking with a smart on-route passenger
            pickup request system. Track active buses across Punjab, view live ETAs,
            and signal the driver to pick you up in one tap.
          </p>
          <div className="hero-actions" style={{ flexWrap: "wrap", gap: "12px" }}>
            <Link to="/routes" className="btn">Find my bus</Link>
            <Link to="/nearby-buses" className="btn primary">Nearby Buses</Link>
            <Link to="/all-buses" className="btn secondary">See all on map</Link>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", justifyContent: "center" }}>
          <div className="info-chip" style={{ margin: 0 }}>
            <div className="info-chip-icon teal"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg></div>
            <div className="info-chip-text">
              <strong>{routeCount}</strong>
              <span>Routes across Punjab</span>
            </div>
          </div>
          <div className="info-chip" style={{ margin: 0 }}>
            <div className="info-chip-icon coral"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
            <div className="info-chip-text">
              <strong>10s</strong>
              <span>GPS update interval</span>
            </div>
          </div>
          <div className="info-chip" style={{ margin: 0 }}>
            <div className="info-chip-icon blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div className="info-chip-text">
              <strong>Smart</strong>
              <span>On-Route Pickup Points</span>
            </div>
          </div>
        </div>
      </div>

      <div className="how-it-works">
        <h2>How it works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Find your bus</h3>
            <p>Select your route to view active buses, check their real-time locations, and inspect current bus capacity.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Request a pickup</h3>
            <p>If you're near the bus's route, tap once to submit a pickup request. Nova verifies your route proximity instantly.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Board & travel</h3>
            <p>The driver receives your request on their mobile dashboard, accepts it, and pulls over to pick you up.</p>
          </div>
        </div>
      </div>
    </>
  );
}
