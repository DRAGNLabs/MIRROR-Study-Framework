import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import surveyRouter from "./routes/surveyRouter.js";
import llmRouter from "./routes/llmRouter.js";
import adminRouter from "./routes/adminRouter.js"
import db from "./db.js";
import "./initDB.js";

import { createServer } from 'http';
import { Server } from 'socket.io'

dotenv.config();

const app = express();

//create HTTP server wrapper (required for Socket.IO)
const httpServer = createServer(app);

// Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173', // hardcoded for now, probably will have to update this later
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    socket.on("join-room", ({ roomCode, user }) => {
        socket.join(roomCode);

        if(!rooms[roomCode]) rooms[roomCode] = [];

        const alreadyInRoom = rooms[roomCode].some((u) => u.id === user.id);

        if (!alreadyInRoom) {
            rooms[roomCode].push(user)
        }

        // send updated user list
        io.to(roomCode).emit("room-users", rooms[roomCode])

        if (rooms[roomCode].length >= 3) {
            io.to(roomCode).emit("start-chat");
        }
    });

    socket.on("send-message", ({ roomCode, message }) => {
        socket.to(roomCode).emit("receive-message", message);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id)
    });
});


app.use(cors());
app.use(express.json());


app.use("/api/users", userRouter);
app.use("/api/survey", surveyRouter);
app.use("/api/llm-response", llmRouter);
app.use("/api/rooms", adminRouter);

const PORT = process.env.PORT || 3001;

//app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
httpServer.listen(PORT, () => 
    console.log(`🚀 Server running on port ${PORT}`)
);
