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
import { getRoom, updateLlmInstructions, appendLlmInstructions, updateLlmResponse, updateUserMessages, roomCompleted } from "../backend/services/roomsService.js"

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
const roundState = {}
// const roundState = {
//   [roomCode]: {
//     round: number,
//     expectedUsers: Set<userId>,
//     submissions: Map<userId, message>,
//     phase: "instructions" | "collecting" | "resolving"
//   }
// }

async function resolveRound(roomCode) {
    console.log("In resolveRound!");
    const state = roundState[roomCode];
    state.phase = "resolving";

    const round = state.round;
    const messagesArray = Array.from(state.submissions.entries());

    const room = await getRoom(roomCode);
    const game = gameMap[room.gameType];
    const totalRounds = game.rounds;
    const responseSystem = game.prompts[round-1].response_system; 
    const instructionsSystem = game.prompts[round-1].instruction_system;
    const existingUserMessages = JSON.parse(room.userMessages || "{}");
    existingUserMessages[round] = messagesArray;
    const systemPrompt = game.prompts[round-1].system_prompt;

    await updateUserMessages(existingUserMessages, roomCode);

    const instructions = JSON.parse(room.llmInstructions)[round];
    const messages = [
        {
            "role": "system", "content": systemPrompt
        },
        {
            "role": "user", "content": instructionsSystem
        },
        {
            "role": "assistant", "content": instructions
        },
        {
            "role": "user", "content": `${responseSystem} \n ${messagesArray.map(([id, msg]) => `User ${id}: ${msg}`).join("\n")}` 
        }
    ]


    // const allocationPrompt = `
    // ${instructions}
    // User  requests: 
    // ${messagesArray.map(([id, msg]) => `User ${id}: ${msg}`).join("\n")}
    
    // Allocate Resoures fairly
    // `;
    console.log(messages);

    io.to(roomCode).emit("ai-start");

    let buffer = "";
    await streamLLM(messages, token => {
        buffer += token;
        io.to(roomCode).emit("ai-token", token);
    });

    io.to(roomCode).emit("ai-end");

    const existingResponses = JSON.parse(room.llmResponse || "{}");
    existingResponses[round] = buffer;
    await updateLlmResponse(existingResponses, roomCode);

    state.submissions.clear();
    state.phase = "idle";

    if (round >= totalRounds) {
        io.to(roomCode).emit("game-complete");
        await roomCompleted(roomCode);
        const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended." };
        io.to(roomCode).emit("receive-message", endGameMsg);
        return;
    } else {
        console.log(`Round ${state.round} completed, waiting for next round...`);
    }

    state.round += 1;

    io.to(roomCode).emit("round-complete", state.round);

    // if (round >= totalRounds) {
    //     io.to(roomCode).emit("game-complete");
    //     return;
    // } else {
    //     console.log(`Round`)
    // }
}
// const roundState = {
//     [roomCode]: {
//         round: number,
//         expectedUsers: Set<userId>,
//         submissions: Map<userId, message>,
//         phase: "instructions" | "collecting" | "resolving"
//     }
// }
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

    socket.on("submit-round-message", async ({ roomCode, userId, userName, text }) => {
        const state = roundState[roomCode];
        if (!state || state.phase !== "collecting") return;

        if (state.submissions.has(userId)) return;

        state.submissions.set(userId, `${userName}: ${text}`);
        const userMsg = { sender: "user", userId: userId, userName: userName, text: text };
        io.to(roomCode).emit("receive-message", userMsg);

        console.log(state.expectedUsers);
        console.log(state.submissions);
        if(state.submissions.size === state.expectedUsers.size) {
            console.log("going into resolveRound hopefully");
            await resolveRound(roomCode);
        }
    })

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
        const roomUsers = rooms[roomCode];
        if (!roomUsers) return;

        // const state = roundState[roomCode];
        // if(!state) {
        //     const room = await getRoom(roomCode);
        //     const userIds = Array.isArray(room.userIds) ? room.userIds: JSON.parse(room.userIds);
        //     roundState[roomCode] = {
        //         round: round,
        //         expectedUsers: new Set(userIds),
        //         submissions: new Map(),
        //         phase: "instructions"
        //     }
        // }

        const room = await getRoom(roomCode);
        const userIds = Array.isArray(room.userIds) ? room.userIds : JSON.parse(room.userIds);
        if (!roundState[roomCode]) {
            roundState[roomCode] = {
                round,
                expectedUsers: new Set(userIds),
                submissions: new Map(),
                phase: "instructions"
            };
        }
        console.log("Starting round:", roundState[roomCode].round);
        const game = gameMap[room.gameType];
        const userPrompt = game.prompts[round-1].instruction_system;
        const systemPrompt = game.prompts[round-1].system_prompt;

        const messages = [
            {
                "role": "system", "content": systemPrompt
            },
            {
                "role": "user", "content": userPrompt
            }
        ]

        io.to(roomCode).emit("ai-start");

        let buffer = "";
        await streamLLM(messages, token => {
            buffer += token;
            io.to(roomCode).emit("ai-token", token);
        });

        io.to(roomCode).emit("ai-end");

        await appendLlmInstructions(roomCode, round, buffer);

        roundState[roomCode].phase = "collecting";

        io.to(roomCode).emit("instructions-complete", round);


        // if (!roomCode || !rooms[roomCode]) {
        //     console.warn("start-round invalid room:", roomCode);
        //     return;
        // } 

        // const room = await getRoom(roomCode);
        // const game = gameMap[room.gameType]
        // // console.log(game);
        // const prompt = game.prompts[round-1].instruction_system;
        // io.to(roomCode).emit("ai-start");
        
        // let buffer = "";
        // await streamLLM(prompt, token => {
        //     buffer += token;
        //     io.to(roomCode).emit("ai-token", token);
        // });

        // io.to(roomCode).emit("ai-end");

        // appendLlmInstructions(roomCode, round, buffer);
     
        // io.to(roomCode).emit("instructions-complete", round); // on client side this should allow users to now send messages
    });

    socket.on("user-messages-round", async ({ roomCode, userId, text }) => {
        const room = rooms[roomCode];

        if (room.receivedMessages.has(userId)) return;

        room.receivedMessages.set(userId, text);

        if(room.receivedMessages.size === room.expectedUsers.size) {
            saveRoundToDB(room.round, room.receivedMessages);
            room.round += 1;
            room.receivedMessages.clear();

            io.to(roomCode).emit("llm-response", room.round);
        }
        // io.to(roomCode).emit("")
    })
    // socket.on("get-llm-response", async ({ roomCode, round }) => {

    //     io.to(roomCode).emit("end-round", round);
    // })

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
