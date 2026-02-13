import { io } from "socket.io-client";
import { SOCKET_URL } from "./config.js";


const socketParams = {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5, 
    reconnectionDelay: 1000, 
}
// When SOCKET_URL is empty (production single-service), io() with no URL
// auto-connects to the current page's origin.
export const socket = SOCKET_URL
    ? io(SOCKET_URL, socketParams)
    : io(socketParams);

