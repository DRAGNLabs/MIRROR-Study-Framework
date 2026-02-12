import { io } from "socket.io-client";
import { SOCKET_URL } from "./config.js";

// When SOCKET_URL is empty (production single-service), io() with no URL
// auto-connects to the current page's origin.
export const socket = SOCKET_URL
    ? io(SOCKET_URL, { autoConnect: true })
    : io({ autoConnect: true });

