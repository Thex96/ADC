import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("trackpoint_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getError(error) {
  return error?.response?.data?.message || error?.message || "Something went wrong.";
}
