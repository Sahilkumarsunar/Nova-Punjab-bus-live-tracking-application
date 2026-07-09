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
            Know where your
            <br />
            bus is, <span className="highlight">right now</span>
          </h1>
          <p>
            NOVA tracks government and private buses across Punjab with
            live GPS updates every 10 seconds. Pick your route, find
            your bus, and stop guessing.
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
            <div className="info-chip-icon blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
            <div className="info-chip-text">
              <strong>3+1</strong>
              <span>Bus operators supported</span>
            </div>
          </div>
        </div>
      </div>

      <div className="how-it-works">
        <h2>How it works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Pick your route</h3>
            <p>Select where you're coming from and where you're headed. Or just search by city name.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Choose a bus</h3>
            <p>See which buses are running on that route, their type, driver info, and current status.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Track live</h3>
            <p>Watch the bus move on the map in real time. See the full route with every stop marked.</p>
          </div>
        </div>
      </div>
    </>
  );
}
