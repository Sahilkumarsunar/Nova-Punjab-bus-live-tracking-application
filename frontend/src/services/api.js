import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

export const getRoutes = () => api.get("/routes").then((r) => r.data);
export const getBusesByRoute = (routeId) =>
  api.get(`/buses/route/${routeId}`).then((r) => r.data);
export const getBuses = () => api.get("/buses").then((r) => r.data);
export const getBus = (id) => api.get(`/buses/${id}`).then((r) => r.data);

export const createPickupRequest = (busId, passengerId, stopName) =>
  api.post(`/buses/${busId}/pickup-request`, { passengerId, stopName }).then((r) => r.data);
export const cancelPickupRequest = (busId, passengerId) =>
  api.post(`/buses/${busId}/pickup-request/cancel`, { passengerId }).then((r) => r.data);
export const getActivePickupRequest = (busId, passengerId) =>
  api.get(`/buses/${busId}/pickup-request/active`, { params: { passengerId } }).then((r) => r.data);

export default api;
