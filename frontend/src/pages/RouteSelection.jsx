import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRoutes } from "../services/api";

export default function RouteSelection() {
  const [routes, setRoutes] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => { getRoutes().then(setRoutes).catch(console.error); }, []);

  const sources = useMemo(() => [...new Set(routes.map((r) => r.source))].sort(), [routes]);
  const destinations = useMemo(
    () => [...new Set(routes.filter((r) => !source || r.source === source).map((r) => r.destination))].sort(),
    [routes, source]
  );
  const matches = routes.filter(
    (r) =>
      (!source || r.source === source) &&
      (!destination || r.destination === destination) &&
      (!search || r.routeName.toLowerCase().includes(search.toLowerCase()) ||
        r.stops.some((s) => s.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Routes</h1>
        <p className="muted">Find a bus route by source, destination, or stop name.</p>
      </div>

      <div className="card">
        <div className="search-input" style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Search by city or stop name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid cols-2">
          <div>
            <label>From</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Any source</option>
              {sources.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>To</label>
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Any destination</option>
              {destinations.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>
          {matches.length} route{matches.length !== 1 ? "s" : ""} found
        </h3>
        {(source || destination || search) && (
          <button
            onClick={() => { setSource(""); setDestination(""); setSearch(""); }}
            style={{
              background: "none", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)", padding: "4px 12px",
              fontSize: 12, cursor: "pointer", color: "var(--ink-muted)",
              fontFamily: "inherit"
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {matches.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p className="muted">No routes match your search. Try a different city.</p>
        </div>
      )}

      {matches.map((r) => (
        <div key={r._id} className="bus-item" onClick={() => navigate(`/routes/${r._id}/buses`)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.2px" }}>
                {r.source} → {r.destination}
              </strong>
              <div className="muted" style={{ marginTop: 3 }}>
                via {r.stops.join(", ") || "direct"}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-faint)" }} />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
}
