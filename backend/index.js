import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import surveyRouter from "./routes/surveyRouter.js";
import adminRouter from "./routes/adminRouter.js";
import roomsRouter from "./routes/roomsRouter.js"
import "./initDB.js";
import { streamLLM } from "./llm.js";
import { createServer } from 'http';
import { Server } from 'socket.io'

import game1 from "../my-app/src/games/game1.json" with { type: "json" };
import game2 from "../my-app/src/games/game2.json" with { type: "json" };
import game3 from "../my-app/src/games/game3.json" with { type: "json" };
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, roomCompleted } from "../backend/services/roomsService.js"

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
const roomState = {}; // this lets you know if game is started or not
const gameState = {};
const surveyStatus = {};
const status = {}; // "waiting" || "instructions" || "interaction" || "survey"
const activeUsers = new Map();
// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(roomCode) {
    const state = gameState[roomCode];
    const round = state.round;
    // const currUserMessages = Array.from(state.userMessages.entries());

    const room = await getRoom(roomCode);
    const instructions = JSON.parse(room.llmInstructions)[round];

    const game = gameMap[room.gameType];
    const totalRounds = game.rounds; // totalRounds needs to equal the length of prompts in game file
    const responsePrompt = game.prompts[round-1].response_prompt; 
    const instructionsPrompt = game.prompts[round-1].instruction_prompt;
    const systemPrompt = game.prompts[round-1].system_prompt;

    // right now when a new round starts the LLM isn't given the messages of the previous round(s), I'm not sure if we want it this way or want the LLM to have context of previous rounds this depends on how we set up the game
    // if we want to give the LLM all the messages from previous rounds we might want to save this in the rooms database
    const currUserNames = Array.from(state.userNames.entries());
    const messages = [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": instructionsPrompt },
        { "role": "assistant", "content": instructions },
        { "role": "user", "content": `${responsePrompt} \n ${currUserNames.map(([id, userName]) => `User ${id}: ${userName} : ${state.userMessages.get(id)}`).join("\n")}` }
    ] 
    // we might want to change the format we are inputting the userMessage, I'm inputting the userId but it is probably not needed for now

    // here we are getting the llmResponse for the current round
    // ai-start just lets the interaction and adminInteraction pages know to create a new message for LLM that will be added to as tokens come in
    io.to(roomCode).emit("ai-start");

    let buffer = "";
    await streamLLM(messages, token => {
        buffer += token;
        io.to(roomCode).emit("ai-token", token); // allows tokens to be appended to LLM message as they come
    });

    // lets interaciton and adminInteraciton know to reset everything since it has received the whole LLM message
    io.to(roomCode).emit("ai-end"); 

    const existingResponses = JSON.parse(room.llmResponse);
    existingResponses[round] = buffer;
    await updateLlmResponse(existingResponses, roomCode);

    state.userMessages.clear();

    if (round >= totalRounds) {
        io.to(roomCode).emit("game-complete");
        const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended." };
        io.to(roomCode).emit("receive-message", endGameMsg);
        return;
    } else {
        console.log(`Round ${round} completed, waiting for next round...`);
    }

    state.round += 1;

    io.to(roomCode).emit("round-complete", state.round);
}

io.on("connection", (socket) => {
   console.log("User connected:", socket.id);
    
    // when admin starts room or when user joins roomCode they are joined to this socket instance
    socket.on("join-room", ({ roomCode, isAdmin, user }) => {
        if (!roomCode || typeof roomCode !== 'number') {
            console.warn("join-room missing or invalid roomCode", roomCode, user);
            return;
        }

        // add user to room
        if(!rooms[roomCode]) {
             rooms[roomCode] = [];
             status[roomCode] = "waiting";
        }
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

        // send user/admin to correct status page
        io.to(roomCode).emit("status", status[roomCode]);

       console.log(isAdmin ? "Admin joined room:" : "User joined room:", roomCode);
    });

    socket.on("show-instructions", async ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("show-instructions invalid roomCode:", roomCode);
        }
        
        status[roomCode] = "instructions";
        io.to(roomCode).emit("to-instructions");
    });


    // this triggers when admin starts game in roomManagement
    socket.on("start-game", async ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("start-game invalid roomCode:", roomCode);
        }
        roomState[roomCode] = true;
        status[roomCode] = "interaction";
        // this one will send users from waitingRoom to interactions page
        io.to(roomCode).emit("start-chat");
    });

    // when admin clicks start on roomManagment page it triggers the round to start and generate the instructions from the LLM
    socket.on("start-round", async ({ roomCode, round }) => {
        const roomUsers = rooms[roomCode];
        if (!roomUsers) return;

        const room = await getRoom(roomCode);
        const userIds = Array.isArray(room.userIds) ? room.userIds : JSON.parse(room.userIds);
        if (!gameState[roomCode]) {
            gameState[roomCode] = {
                round,
                userIds: new Set(userIds),
                userMessages: new Map(),
                userNames: new Map()
            };
        }
    
        const game = gameMap[room.gameType];
        const userPrompt = game.prompts[round-1].instruction_prompt;
        const systemPrompt = game.prompts[round-1].system_prompt;

        const messages = [
            { "role": "system", "content": systemPrompt },
            { "role": "user", "content": userPrompt }
        ]

        // getting instructions from LLM below
        io.to(roomCode).emit("ai-start");

        let buffer = "";
        await streamLLM(messages, token => {
            buffer += token;
            io.to(roomCode).emit("ai-token", token);
        });

        io.to(roomCode).emit("ai-end");

        await appendLlmInstructions(roomCode, round, buffer);

        // lets interaction page know that the instructions are complete so the user can send a message now (they are blocked from sending one before this)
        io.to(roomCode).emit("instructions-complete", round);
    });

        // this is called when user submits message on interaction page
    socket.on("submit-round-message", async ({ roomCode, userId, userName, text }) => {
        const state = gameState[roomCode];

        if (state.userMessages.has(userId)) return;

        state.userMessages.set(userId, text);
        state.userNames.set(userId, userName);
        const userMsg = { sender: "user", userId: userId, userName: userName, text: text };

        const round = state.round;
        const currUserMessages = Array.from(state.userMessages.entries());

        const room = await getRoom(roomCode);
        const existingUserMessages = JSON.parse(room.userMessages);
        existingUserMessages[round] = currUserMessages;
        await updateUserMessages(existingUserMessages, roomCode);

        // this sends the sent message to all users and admin interaction pages so it shows up on the chat box
        io.to(roomCode).emit("receive-message", userMsg);

      
        if(state.userMessages.size === state.userIds.size) {
            await getLlmResponse(roomCode);
        }
    });


    // this triggers when admin clicks next on adminInteraction page
    socket.on("start-survey", ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("startSurvey invalid roomCode:", roomCode);
        }
        status[roomCode] = "survey";
        // this sends user from interaction page to survey page
        io.to(roomCode).emit("start-user-survey");
    });

    // this disconnects users entirely from room if admin closes it while they're in it
    socket.on("close-room", ({ roomCode }) => {
        roomState[roomCode] = false;
        io.to(roomCode).emit("force-return-to-login");
        const clients = io.sockets.adapter.rooms.get(roomCode);
        if (clients) {
            clients.forEach(clientId => {
                const clientSocket = io.sockets.sockets.get(clientId);
                clientSocket.leave(roomCode); // remove from room
                clientSocket.disconnect(true); // optional: fully disconnect
            });
        }
    })

    socket.on("survey-complete", async ({ roomCode, userId, surveyId }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("survey complete invalid roomCode:", roomCode);
        }
        if (!surveyStatus[roomCode]) {
            surveyStatus[roomCode] = new Set();
        }

        surveyStatus[roomCode].add(userId);

        io.to(roomCode).emit("user-survey-complete", { userId, surveyId });
        const currRoom = await getRoom(roomCode);
        if(surveyStatus[roomCode].size === JSON.parse(currRoom.userIds).length) {
            console.log(`All surveys complete for room ${roomCode}`);
            await roomCompleted(roomCode);
            // io.to(roomCode).emit("all-surveys-complete")
        }    
    });

    // this is for if someone leaves the room while they're waiting
    socket.on("leave-room", ({ roomCode, userId }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("leave-room invalid roomCode:", roomCode);
        }

        rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== userId);
        io.to(roomCode).emit("room-users", rooms[roomCode]);


        // if not enough users send back to waiting room
        // need to fix this
        // if (roomState[roomCode] && rooms[roomCode].length < 3) {
        //     roomState[roomCode] = false;
        //     io.to(roomCode).emit("force-return-to-waiting-room");
        // }


        socket.leave(roomCode);
        delete socketUserMap[socket.id];
    });

    // also keeps track of users leaving a room
    socket.on("disconnect", () => {
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { roomCode, isAdmin, user } = data
        if(!isAdmin) {
            rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);
            io.to(roomCode).emit("room-users", rooms[roomCode]);
        }

        // If not enough users send back to waiting room
        // need to fix this
        // if (roomState[roomCode] && rooms[roomCode].length < 3) {
        //     roomState[roomCode] = false;
        //     io.to(roomCode).emit("force-return-to-waiting-room");
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
