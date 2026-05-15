import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="nav">
      <div className="brand">NOVA</div>
      <div className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/routes">Routes</NavLink>
        <NavLink to="/all-buses">All Buses</NavLink>
      </div>
    </nav>
  );
}
