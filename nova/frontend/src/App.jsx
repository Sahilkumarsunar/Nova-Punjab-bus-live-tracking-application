import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import RouteSelection from "./pages/RouteSelection.jsx";
import BusListing from "./pages/BusListing.jsx";
import BusDetails from "./pages/BusDetails.jsx";
import LiveTracking from "./pages/LiveTracking.jsx";
import AllBusesMap from "./pages/AllBusesMap.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/routes" element={<RouteSelection />} />
          <Route path="/routes/:routeId/buses" element={<BusListing />} />
          <Route path="/buses/:busId" element={<BusDetails />} />
          <Route path="/buses/:busId/track" element={<LiveTracking />} />
          <Route path="/all-buses" element={<AllBusesMap />} />
        </Routes>
      </div>
    </>
  );
}
