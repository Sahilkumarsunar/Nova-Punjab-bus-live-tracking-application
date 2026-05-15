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
          <div className="hero-actions">
            <Link to="/routes" className="btn">Find my bus</Link>
            <Link to="/all-buses" className="btn secondary">See all buses on map</Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="route-preview">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 4 }}>
              Sample Route
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}>
              Jalandhar → Chandigarh
            </div>
            <div className="route-preview-line">
              <div className="route-dot"></div>
              <div className="route-line"></div>
              <div className="route-dot end"></div>
              <div className="route-stop-chip">Phagwara</div>
              <div className="route-stop-chip">Ludhiana</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-muted)" }}>
              <span>Jalandhar</span>
              <span>Chandigarh</span>
            </div>
          </div>
          <div style={{
            display: "flex", gap: 8, marginTop: 16, fontSize: 12, color: "var(--ink-muted)"
          }}>
            <span style={{
              background: "var(--green-light)", color: "var(--green)",
              padding: "4px 10px", borderRadius: 999, fontWeight: 600
            }}>● 1 bus active</span>
            <span style={{
              background: "var(--bg)", padding: "4px 10px",
              borderRadius: 999, fontWeight: 500
            }}>4 stops</span>
          </div>
        </div>
      </div>

      <div className="info-strip">
        <div className="info-chip">
          <div className="info-chip-icon teal">🛣️</div>
          <div className="info-chip-text">
            <strong>{routeCount}</strong>
            <span>Routes across Punjab</span>
          </div>
        </div>
        <div className="info-chip">
          <div className="info-chip-icon coral">⚡</div>
          <div className="info-chip-text">
            <strong>10s</strong>
            <span>GPS update interval</span>
          </div>
        </div>
        <div className="info-chip">
          <div className="info-chip-icon blue">🏛️</div>
          <div className="info-chip-text">
            <strong>3+1</strong>
            <span>Bus operators supported</span>
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
