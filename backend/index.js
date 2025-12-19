import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import surveyRouter from "./routes/surveyRouter.js";
import adminRouter from "./routes/adminRouter.js";
import roomsRouter from "./routes/roomsRouter.js"
import db from "./db.js";
import "./initDB.js";
import { streamLLM } from "./llm.js";
import { createServer } from 'http';
import { Server } from 'socket.io'

import game1 from "../my-app/src/games/game1.json" with { type: "json" };
import game2 from "../my-app/src/games/game2.json" with { type: "json" };
import game3 from "../my-app/src/games/game3.json" with { type: "json" };
import { getRoom, updateLlmInstructions, appendLlmInstructions } from "../backend/services/roomsService.js"

const gameMap = {
    1: game1,
    2: game2, 
    3: game3
}

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173', // hardcoded for now, probably will have to update this later import from config file
        methods: ["GET", "POST"]
    }
});

const rooms = {};
const socketUserMap = {};
const roomState = {};
io.on("connection", (socket) => {
   console.log("User connected:", socket.id);
    
    socket.on("join-room", ({ roomCode, isAdmin, user }) => {
        if (!roomCode || typeof roomCode !== 'number') {
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

    socket.on("start-round", async ({ roomCode, round }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("start-round invalid room:", roomCode);
            return;
        } 

        const room = await getRoom(roomCode);
        const game = gameMap[room.gameType]
        // console.log(game);
        const prompt = game.prompts[round-1].instruction_system;
        // console.log(prompt);
        // const room = await
        // const game = gameMap[gameType];
        // const instructionsPrompt = game.instruction_system;
        io.to(roomCode).emit("ai-start");
        
        let buffer = "";
        await streamLLM(prompt, token => {
            buffer += token;
            io.to(roomCode).emit("ai-token", token);
        });

        io.to(roomCode).emit("ai-end");

        // need to somehow get room from database to update it with the buffer
        // const existing = JSON.parse(room.llmInstructions);
        // existing[round] = buffer;

        // await updateRoomField(roomCode, "llmInstructions", existing);
        const existingInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {}
        if (existingInstructions[round]) {
            throw new Error(`Round ${round} instructions already exist`);
        }
        const updatedInstructions = {
            ...existingInstructions,
            [round]: buffer
        }
        db.run(
            "UPDATE rooms SET llmInstructions = ? WHERE roomCode = ?",
            [JSON.stringify(updatedInstructions), roomCode]
        );
        // await updateLlmInstructions({
        //     ...existingInstructions,
        //     [round]: buffer
        // }, roomCode
        // ); 
        io.to(roomCode).emit("instructions-complete", round); // on client side this should allow users to now send messages
    })

    // socket.on("user-messages-round", async ({ roomCode }) => {

    //     io.to(roomCode).emit("")
    // })
    socket.on("get-llm-response", async ({ roomCode, round }) => {

        io.to(roomCode).emit("end-round", round);
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
app.use("/api/rooms", roomsRouter);
app.use("/api/admin", adminRouter);


const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => 
    console.log(`🚀 Server running on port ${PORT}`)
);
