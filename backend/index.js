import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import surveyRouter from "./routes/surveyRouter.js";
import llmRouter from "./routes/llmRouter.js";
import adminRouter from "./routes/adminRouter.js"
import db from "./db.js";
import "./initDB.js";
import { streamLLM } from "./llm.js";

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
    
    socket.on("join-room", ({ roomCode, isAdmin, user }) => {
        if (!roomCode || typeof roomCode !== "string") {
            console.warn("join-room missing or invalid roomCode", roomCode, user);
            return;
        }

        // add user to room
        if(!rooms[roomCode]) rooms[roomCode] = [];
        socket.join(roomCode);
        socketUserMap[socket.id] = { roomCode, isAdmin, user }; // should I track admin here?
        if (!isAdmin) {
            
            const alreadyInRoom = rooms[roomCode].some((u) => u.userId === user.userId);
            if (!alreadyInRoom) {
                rooms[roomCode].push(user);
            }
        }
        // send updated user list
        io.to(roomCode).emit("room-users", rooms[roomCode]);

       console.log(isAdmin ? "Admin joined room:" : "User joined room:", roomCode);
    });

    socket.on("startGame", ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("startGame invalid roomCode:", roomCode);
        }
        roomState[roomCode] = true;
        io.to(roomCode).emit("start-chat");
    });

    socket.on("startSurvey", ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("startSurvey invalid roomCode:", roomCode);
        }
        io.to(roomCode).emit("startUserSurvey");
    })

    socket.on("send-message", ({ roomCode, message }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("send-message invalid roomCode:", roomCode);
        }
        if (!message) {
            console.warn("message not present");
        }
        socket.to(roomCode).emit("receive-message", message); 
    });

    socket.on("generate-ai", async ({ roomCode, prompt }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("generate-ai invalid room:", roomCode);
            return;
        }
        try {
            io.to(roomCode).emit("ai-start");

            await streamLLM(prompt, async (token) => {
                io.to(roomCode).emit("ai-token", token);
            });

            io.to(roomCode).emit("ai-end");
        } catch (error) {
            console.error("LLM Stream Error:", error);
            io.to(roomCode).emit("ai-error", "LLM failed"); // do I want this?
        }
    })

    socket.on("leave-room", ({ roomCode, userId }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("leave-room invalid roomCode:", roomCode);
        }

        rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== userId);
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        // if not enough users send back to waiting room
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        socket.leave(roomCode);
        delete socketUserMap[socket.id];
    });

    socket.on("disconnect", () => {
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { roomCode, isAdmin, user } = data
        if(!isAdmin) {
            rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);
            io.to(roomCode).emit("room-users", rooms[roomCode]);
        }

        // If not enough users send back to waiting room
        if (roomState[roomCode] && rooms[roomCode].length < 3) {
            roomState[roomCode] = false;
            io.to(roomCode).emit("force-return-to-waiting-room");
        }

        // if(isAdmin) {
        //     io.to(roomCode).emit("force-to-login");
        // }

        // Clean up mapping
        delete socketUserMap[socket.id];
        console.log("User disconnected:", socket.id)
    });

    socket.on("connect_error", (err) => {
        console.error("Connection error:", err.message);
    });

    socket.on("connect_timeout", () => {
        console.error("Connection timed out:", socket.id);
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
