import { io } from "socket.io-client";

export const socket = io("http://localhost:3001", {
    autoConnect: true
}); // hardcoded, will have to change this later

