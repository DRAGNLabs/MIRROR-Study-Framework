import { io } from "socket.io-client";
import { SOCKET_URL } from "./config.js";


const socketParams = {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10, 
    reconnectionDelay: 1000, 
}
// When SOCKET_URL is empty (production single-service), io() with no URL
// auto-connects to the current page's origin.
export const socket = SOCKET_URL
    ? io(SOCKET_URL, socketParams)
    : io(socketParams);

    socket.on("connect", () => {
        console.log("Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.log("Disconnected ", reason, socket.id);
    });

    socket.on("connect_error", (err) => {
        console.log("Connection error:", err.message);
    });

    // socket.on("connect_timeout", () => {
    //     console.log("Connection timed out:", socket.id);
    // });

    socket.on("reconnect_attempt", (attempt) => {
        console.log("Reconnect attempt:", attempt);
    });

    socket.on("reconnect", (attempt) => {
        console.log("Reconnected after", attempt, "attempts");
    });

    socket.on("reconnect_failed", () => {
        console.log("Reconnect failed permanently");
    });