import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("study-anchor-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("study-anchor-token");
    }
    if (err.response?.status === 429) {
      return Promise.reject({ message: err.response.data?.message || "Too many requests — please wait a moment." });
    }
    return Promise.reject(err.response?.data || { message: "Network error. Please try again." });
  }
);

export default api;
