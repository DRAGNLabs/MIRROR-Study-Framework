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
const socketUserMap = {};
const roomState = {};
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    socket.on("join-room", ({ roomCode, user }) => {
        if (!roomCode || !user) {
            console.warn("join-room missing roomCode or user", roomCode, user);
            return;
        }

        socket.join(roomCode);
        socketUserMap[socket.id] = { roomCode, user };

        if(!rooms[roomCode]) rooms[roomCode] = [];
        const alreadyInRoom = rooms[roomCode].some((u) => u.userId === user.userId); // make sure this line is working?
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
        io.to(roomCode).emit("receive-message", message); 
    });

    // START OF NEW CODE
    socket.on("leave-room", ({ roomCode, userId }) => {
        if (!roomCode || !rooms[roomCode]) return;
        if (!rooms[roomCode]) return;

        // remove user
        rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== userId);
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        // if not enough users left
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        // io.to(roomCode).emit("room-users", rooms[roomCode])

        socket.leave(roomCode);
    });
    // END OF NEW CODE

    socket.on("disconnect", () => {
        // START OF NEW CODE
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { roomCode, user } = data
        rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);

        // // Broadcast updated user list
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        // If not enough users left, send them back to waiting
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        // Broadcast updated user list

        // Clean up mapping
        delete socketUserMap[socket.id];
        // END OF NEW CODE
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
