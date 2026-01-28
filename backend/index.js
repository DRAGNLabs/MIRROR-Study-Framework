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
import { loadGames } from "./services/gameLoader.js";
const games = loadGames();
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, roomCompleted } from "../backend/services/roomsService.js"


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
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(roomCode) {
    const state = gameState[roomCode];
    const round = state.round;
    // console.log("get llm response round", round);
    // const currUserMessages = Array.from(state.userMessages.entries());

    const room = await getRoom(roomCode);
    // const instructions = JSON.parse(room.llmInstructions)[round];

    const game = games.find(g => parseInt(g.id) === room.gameType)
    const totalRounds = game.rounds; // totalRounds needs to equal the length of prompts in game file
    const responsePrompt = game.prompts[0].response_prompt; 
    const instructionsPrompt = game.prompts[0].instruction_prompt;
    const systemPrompt = game.prompts[0].system_prompt;
    const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
    const llmResponses = room.llmResponse ? JSON.parse(room.llmResponse) : {};
    const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};

    const userNames = Array.from(state.userNames.entries())
        .reduce((acc, [id, name]) => {
        acc[id] = name;
        return acc;
    }, {});
    // const messages = [
    //     { "role": "system", "content": systemPrompt },
    //     { "role": "user", "content": instructionsPrompt },
    //     { "role": "assistant", "content": instructions },
    //     { "role": "user", "content": `${responsePrompt} \n ${currUserNames.map(([id, userName]) => `User ${id}: ${userName} : ${state.userMessages.get(id)}`).join("\n")}` }
    // ] 
    const messages = [
        { "role": "system", "content": systemPrompt },
    ]
    // loop through rounds:
    for (let i = 1; i <= round; i++) {
        messages.push({ "role": "user", "content": instructionsPrompt })
        messages.push({ "role": "assistant", "content": llmInstructions[i] });
        // const roundMessages = userMessages[i] || [];
        const formattedUserMessages = userMessages[i].map(([userId, text]) => {
            const name = userNames[userId] || `User ${userId}`;
            return `${name}: ${text}`;
        }).join("\n");
        messages.push({"role": "user", "content": `${responsePrompt} \n ${formattedUserMessages}` });
        if(!llmResponses[i]) break;
        messages.push({ "role": "assistant", "content": llmResponses[i] })
    }

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
//    console.log("Client connected:", socket.id);
    // console.log("Client connected:", socket.id, "Current connections:", io.engine.clientsCount);

    // when admin starts room or when user joins roomCode they are joined to this socket instance
    socket.on("join-room", async ({ roomCode, isAdmin, user }) => {
        if (!roomCode || typeof roomCode !== 'number') {
            console.warn("join-room missing or invalid roomCode", roomCode, user);
            return;
        }

        // if (socket.rooms.has(roomCode)) {
        //     console.log("Socket already in room:", roomCode);
        //     return;

        // }

        if(!rooms[roomCode]) {
             rooms[roomCode] = [];
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

        const room = await getRoom(roomCode);
        // send user/admin to correct status page
        io.to(roomCode).emit("status", room.status);

       console.log(isAdmin ? "Admin joined room:" : "User joined room:", roomCode, socket.id);
    });

    socket.on("show-instructions", async ({roomCode}) => {
        if (!roomCode) return;

        io.to(roomCode).emit("to-instructions");
    });


    // this triggers when admin starts game in roomManagement
    socket.on("start-game", async ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("start-game invalid roomCode:", roomCode);
            return;
        }
        roomState[roomCode] = true;
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

        const state = gameState[roomCode];
        const currRound = state.round;
        console.log("start round", currRound);
    
        const game = games.find(g => parseInt(g.id) === room.gameType)
        const instructionsPrompt = game.prompts[0].instruction_prompt;
        const systemPrompt = game.prompts[0].system_prompt;
        const responsePrompt = game.prompts[0].response_prompt; 
        const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
        const llmResponses = room.llmResponse ? JSON.parse(room.llmResponse) : {};
        const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};

        const userNames = Array.from(state.userNames.entries())
            .reduce((acc, [id, name]) => {
            acc[id] = name;
            return acc;
        }, {});

        // also change this we need the context of either the previous round or all of them
        const messages = [
            { "role": "system", "content": systemPrompt },
        ]
        // loop through rounds:
        for (let i = 1; i <= currRound; i++) {
            messages.push({ "role": "user", "content": instructionsPrompt });
            if (!llmInstructions[i]) break;
            messages.push({ "role": "assistant", "content": llmInstructions[i] });
            // const roundMessages = userMessages[i] || [];
            const formattedUserMessages = userMessages[i].map(([userId, text]) => {
            const name = userNames[userId] || `User ${userId}`;
                return `${name}: ${text}`;
            }).join("\n");
            messages.push({"role": "user", "content": `${responsePrompt} \n ${formattedUserMessages}` });
            messages.push({ "role": "assistant", "content": llmResponses[i] })
        }

        // console.log("Messages in start round: ", messages);
        // const messages = [
        //     { "role": "system", "content": systemPrompt },
        //     { "role": "user", "content": userPrompt }
        // ]

        // getting instructions from LLM below
        await delay(2000); // it keeps missing the ai-start socket this fixed it, probably not best way but it works
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

        //need to check into this
        if (!state.userMessages || state.userMessages.has(userId)) return;

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
            await getLlmResponse(roomCode); // if a user leaves in middle of round this is called before that user sends their message
        }
    });


    // this triggers when admin clicks next on adminInteraction page
    socket.on("start-survey", ({roomCode}) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("startSurvey invalid roomCode:", roomCode);
        }
        // this sends user from interaction page to survey page
        io.to(roomCode).emit("start-user-survey");
    });

    // this disconnects users entirely from room if admin closes it while they're in it
    socket.on("close-room", ({ roomCode }) => {
        if(!roomCode) return;

        roomState[roomCode] = false;
        io.to(roomCode).emit("force-return-to-login");
        const clients = io.sockets.adapter.rooms.get(roomCode);
        if (clients) {
            clients.forEach(clientId => {
                const clientSocket = io.sockets.sockets.get(clientId);
                clientSocket.leave(roomCode); // remove from room
            });
        }
        delete rooms[roomCode];
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
            await roomCompleted(roomCode);
            // io.to(roomCode).emit("all-surveys-complete")
        }    
    });

    // this is for if someone leaves the room while they're waiting
    socket.on("leave-room", ({ roomCode, userId }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("leave-room invalid roomCode:", roomCode);
            return;
        }
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { isAdmin, user } = data

        rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== userId);
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        socket.leave(roomCode);
        delete socketUserMap[socket.id];
        if (isAdmin) {
            console.log("admin left room:", socket.id);
        } else {
            console.log("User left room:", socket.id, user.userName);
        }
    });

    // also keeps track of users leaving a room
    socket.on("disconnect", () => {
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { roomCode, isAdmin, user } = data
        if(!roomCode || !rooms[roomCode]) {
            return;
        }
        if(!isAdmin) {
            rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);
            io.to(roomCode).emit("room-users", rooms[roomCode]);
        }

        // Clean up mapping
        socket.leave(roomCode);
        delete socketUserMap[socket.id];
        if (isAdmin) {
            console.log("admin disconnected:", socket.id);
        } else {
            console.log("User disconnected:", socket.id, user.userName);
        }
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
