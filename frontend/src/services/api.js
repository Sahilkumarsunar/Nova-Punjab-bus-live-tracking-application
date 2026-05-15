import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

export const getRoutes = () => api.get("/routes").then((r) => r.data);
export const getBusesByRoute = (routeId) =>
  api.get(`/buses/route/${routeId}`).then((r) => r.data);
export const getBus = (id) => api.get(`/buses/${id}`).then((r) => r.data);

export default api;
