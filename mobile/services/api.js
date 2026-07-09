import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL = "http://10.84.255.91:5000/api";
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const register = (data) => api.post("/auth/register", data).then((r) => r.data);
export const login = (data) => api.post("/auth/login", data).then((r) => r.data);
export const me = () => api.get("/auth/me").then((r) => r.data);

export const getRoutes = () => api.get("/routes").then((r) => r.data);
export const getMyBus = () => api.get("/buses/mine").then((r) => r.data);
export const registerBus = (data) => api.post("/buses/register", data).then((r) => r.data);
export const updateLocation = (busId, latitude, longitude, heading, speed, timestamp) =>
  api.put(`/buses/${busId}/location`, {
    latitude,
    longitude,
    ...(heading != null ? { heading } : {}),
    ...(speed != null ? { speed } : {}),
    ...(timestamp != null ? { timestamp } : {})
  }).then((r) => r.data);
export const startTrip = (busId) => api.post(`/buses/${busId}/start-trip`).then((r) => r.data);
export const stopTrip = (busId) => api.post(`/buses/${busId}/stop-trip`).then((r) => r.data);

export const getPickupRequests = (busId) => api.get(`/buses/${busId}/pickup-requests`).then((r) => r.data);
export const updatePickupRequestStatus = (busId, requestId, status) =>
  api.put(`/buses/${busId}/pickup-request/${requestId}`, { status }).then((r) => r.data);
export const updateTripSettings = (busId, settings) =>
  api.put(`/buses/${busId}/trip-settings`, settings).then((r) => r.data);

export default api;
