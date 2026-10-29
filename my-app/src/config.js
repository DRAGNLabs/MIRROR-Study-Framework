// In dev, use relative URLs so Vite's proxy forwards requests to the backend
// (port 3001 on localhost). This works for both localhost and phone access
// over the local network without any CORS configuration.
// In production, same-origin applies (backend serves the frontend).
// const baseUrl = import.meta.env.VITE_API_URL || "";
const baseUrl = import.meta.env.VITE_API_URL
    || (import.meta.env.DEV ? "http://localhost:3001" : "");

export const API_BASE = `${baseUrl}/api`;
export const SOCKET_URL = baseUrl;

// const getBaseUrl = () => {
//     if (import.meta.env.VITE_API_URL) {
//         return import.meta.env.VITE_API_URL;
//     }
    
//     if (import.meta.env.DEV) {
//         const hostname = window.location.hostname;
//         return `http://${hostname}:3001`;
//     }
    
//     return "";
// };

// const baseUrl = getBaseUrl();
// export const API_BASE = `${baseUrl}/api`;
// export const SOCKET_URL = baseUrl;