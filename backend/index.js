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
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, roomCompleted, getUser, getSurveyStatus } from "../backend/services/roomsService.js"


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
const usersInRoom = {}
const socketUserMap = {}; 
const currRounds = {} // I want to change this to rely on database (more secure)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(roomCode) {
    const round = currRounds[roomCode];

    const room = await getRoom(roomCode);

    const game = games.find(g => parseInt(g.id) === room.gameType)
    const totalRounds = game.rounds; // totalRounds needs to equal the length of prompts in game file
    const responsePrompt = game.prompts[0].response_prompt; 
    const instructionsPrompt = game.prompts[0].instruction_prompt;
    const systemPrompt = game.prompts[0].system_prompt;
    const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
    const llmResponses = room.llmResponse ? JSON.parse(room.llmResponse) : {};
    const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};


    const messages = [
        { "role": "system", "content": systemPrompt },
    ]
    // loop through rounds:
    for (let i = 1; i <= round; i++) {
        messages.push({ "role": "user", "content": instructionsPrompt })
        messages.push({ "role": "assistant", "content": llmInstructions[i] });
        const formattedUserMessages =  ( 
            await Promise.all(
                userMessages[i].map(async ([userId, text]) => {
                    const user = await getUser(userId) 
                    const name = user?.userName || `User ${userId}`;
                    return `${name}: ${text}`;
                })
            )
        ).join("\n");

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


    if (round >= totalRounds) {
        io.to(roomCode).emit("game-complete");
        const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended." };
        io.to(roomCode).emit("receive-message", endGameMsg);
        return;
    } else {
        console.log(`Round ${round} completed, waiting for next round...`);
    }

    currRounds[roomCode] += 1;

    io.to(roomCode).emit("round-complete", currRounds[roomCode]);
}

io.on("connection", (socket) => {
//    console.log("Client connected:", socket.id);

    // when admin starts room or when user joins roomCode they are joined to this socket instance
    socket.on("join-room", async ({ roomCode, isAdmin, user }) => {
        if (!roomCode || typeof roomCode !== 'number') {
            console.warn("join-room missing or invalid roomCode", roomCode, isAdmin, user);
            return;
        }

        // if (socket.rooms.has(roomCode)) {
        //     console.log("Socket already in room:", roomCode);
        //     return;

        // }

        if(!rooms[roomCode]) {
             rooms[roomCode] = [];
        }

        const currSocket = socketUserMap[socket.id];
        if (currSocket) {
            const socketRoomCode = currSocket.roomCode;
            if (socketRoomCode == roomCode) {
                return;
            }
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
        if (!roomCode) {
            console.warn("start-game invalid roomCode:", roomCode);
            return;
        }
        // this one will send users from waitingRoom to interactions page
        io.to(roomCode).emit("start-chat");
    });

    // when admin clicks start on roomManagment page it triggers the round to start and generate the instructions from the LLM
    socket.on("start-round", async ({ roomCode, round }) => {

        const room = await getRoom(roomCode);
        if (!currRounds[roomCode]) {
            currRounds[roomCode] = round
        }
    
        const game = games.find(g => parseInt(g.id) === room.gameType)
        const instructionsPrompt = game.prompts[0].instruction_prompt;
        const systemPrompt = game.prompts[0].system_prompt;
        const responsePrompt = game.prompts[0].response_prompt; 
        const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
        const llmResponses = room.llmResponse ? JSON.parse(room.llmResponse) : {};
        const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};

        // also change this we need the context of either the previous round or all of them
        const messages = [
            { "role": "system", "content": systemPrompt },
        ]
        // loop through rounds:
        for (let i = 1; i <= round; i++) {
            messages.push({ "role": "user", "content": instructionsPrompt });
            if (!llmInstructions[i]) break;
            messages.push({ "role": "assistant", "content": llmInstructions[i] });
            // const roundMessages = userMessages[i] || [];
            const formattedUserMessages =  ( 
                await Promise.all(
                    userMessages[i].map(async ([userId, text]) => {
                        const user = await getUser(userId) 
                        const name = user?.userName || `User ${userId}`;
                        return `${name}: ${text}`;
                    })
                )
            ).join("\n");
            messages.push({"role": "user", "content": `${responsePrompt} \n ${formattedUserMessages}` });
            messages.push({ "role": "assistant", "content": llmResponses[i] })
        }

        // getting instructions from LLM below
        await delay(500); // it keeps missing the ai-start socket this fixed it, probably not best way but it works
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
        const round = currRounds[roomCode];
        const userMsg = { sender: "user", userId: userId, userName: userName, text: text };

        const room = await getRoom(roomCode);
        const existingUserMessages = JSON.parse(room.userMessages);
        const roundMessages = existingUserMessages[round] ?? [];
        const alreadySubmitted = roundMessages.some(
            ([existingUserId]) => existingUserId === userId
        );

        if (alreadySubmitted) return;

        if(existingUserMessages) {
            if (!existingUserMessages[round]) {
                existingUserMessages[round] = [[userId, text]];
            } else {
                existingUserMessages[round].push([userId, text]);
            }
        }
        await updateUserMessages(existingUserMessages, roomCode);

        // this sends the sent message to all users and admin interaction pages so it shows up on the chat box
        io.to(roomCode).emit("receive-message", userMsg);

        if(existingUserMessages[round].length === JSON.parse(room.userIds).length) {
            await getLlmResponse(roomCode); // if a user leaves in middle of round this is called before that user sends their message
        }
    });


    // this triggers when admin clicks next on adminInteraction page
    socket.on("start-survey", ({roomCode}) => {
        if (!roomCode) {
            console.warn("startSurvey invalid roomCode:", roomCode);
            return;
        }
        // this sends user from interaction page to survey page
        io.to(roomCode).emit("start-user-survey");
    });

    // this disconnects users entirely from room if admin closes it while they're in it
    socket.on("close-room", ({ roomCode }) => {
        if(!roomCode) return;

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
        if (!roomCode) {
            console.warn("survey complete invalid roomCode:", roomCode);
        }

        io.to(roomCode).emit("user-survey-complete", { userId, surveyId });
        const currRoom = await getRoom(roomCode);

        let surveyCompleted = true;
        for (const id of JSON.parse(currRoom.userIds)) {
            const { completed } = await getSurveyStatus(userId)
            if (completed == 0) surveyCompleted = false;
        }

        if(surveyCompleted) {
            await roomCompleted(roomCode);
        }
    });

    // this is for if someone leaves the room while they're waiting
    socket.on("leave-room", ({ roomCode }) => {
        if (!roomCode || !rooms[roomCode]) {
            console.warn("leave-room invalid roomCode:", roomCode);
            return;
        }
        const data = socketUserMap[socket.id]
        if (!data)  return;

        const { isAdmin, user } = data
        if (!isAdmin) {
            rooms[roomCode] = rooms[roomCode].filter(u => u.userId !== user.userId);
        }
        io.to(roomCode).emit("room-users", rooms[roomCode]);

        socket.leave(roomCode);
        delete socketUserMap[socket.id];
        if (isAdmin) {
            console.log("Admin left room:", socket.id);
        } else {
            console.log("User left room:", socket.id, user.userName);
        }
    });

    // also keeps track of users leaving a room
    socket.on("disconnect", () => {
        const data = socketUserMap[socket.id]
        if (!data)  return; //basically if not part of a room

        const { roomCode, isAdmin, user } = data
        // if(!rooms[roomCode]) {
        //     return;
        // }
        
        if(!isAdmin && user) {
            rooms[roomCode] = rooms[roomCode].filter((u) => u.userId !== user.userId);
            io.to(roomCode).emit("room-users", rooms[roomCode]);
        }

        // Clean up mapping
        socket.leave(roomCode);
        delete socketUserMap[socket.id];
        if (isAdmin) {
            console.log("Admin disconnected:", socket.id);
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
