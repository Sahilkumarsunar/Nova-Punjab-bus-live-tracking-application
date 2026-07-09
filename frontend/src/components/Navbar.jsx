import { NavLink, Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="nav">
      <Link to="/" className="brand">NOVA</Link>
      <div className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/routes">Routes</NavLink>
        <NavLink to="/nearby-buses">Nearby</NavLink>
        <NavLink to="/all-buses">Map</NavLink>
      </div>
    </nav>
  );
}
