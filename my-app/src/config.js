// VITE_API_URL is a build-time variable:
// - Local dev (vite dev server): not set, defaults to http://localhost:3001
// - Production (single-service, backend serves frontend): not set, uses "" (same origin)
// - Two-service deploy: set to the backend URL (e.g., https://backend.up.railway.app)
const baseUrl = import.meta.env.VITE_API_URL
    || (import.meta.env.DEV ? "http://localhost:3001" : "");

export const API_BASE = `${baseUrl}/api`;
export const SOCKET_URL = baseUrl;
