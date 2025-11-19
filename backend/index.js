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

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173', // hardcoded for now, probably will have to update this later
        methods: ["GET", "POST"]
    }
});

const rooms = {};
const socketUserMap = {};
const roomState = {};
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    socket.on("join-room", ({ roomCode, user }) => {
        if (!roomCode || !user) {
            console.warn("join-room missing roomCode or user", roomCode, user);
            return;
        }

        // add user to room
        socket.join(roomCode);
        socketUserMap[socket.id] = { roomCode, user };

        if(!rooms[roomCode]) rooms[roomCode] = [];
        const alreadyInRoom = rooms[roomCode].some((u) => u.userId === user.userId);
        if (!alreadyInRoom) {
            rooms[roomCode].push(user)
        }

        // send updated user list
        io.to(roomCode).emit("room-users", rooms[roomCode])

        if (!roomState[roomCode] && rooms[roomCode].length >= 3) {
            roomState[roomCode] = true;
            io.to(roomCode).emit("start-chat");
        }
    });

    socket.on("send-message", ({ roomCode, message }) => {
        if (!roomCode || ! message) return;
        socket.to(roomCode).emit("receive-message", message); 
    });

    socket.on("leave-room", ({ roomCode, userId }) => {
        if (!roomCode || !rooms[roomCode]) return;

        rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== userId);
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        // if not enough users send back to waiting room
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        socket.leave(roomCode);
    });

    socket.on("disconnect", () => {
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { roomCode, user } = data
        rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);

        // sends updated users list
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        // If not enough users send back to waiting room
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        // Clean up mapping
        delete socketUserMap[socket.id];
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

httpServer.listen(PORT, () => 
    console.log(`🚀 Server running on port ${PORT}`)
);
