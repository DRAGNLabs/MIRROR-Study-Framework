import { Server } from 'socket.io';
import { handleCloseRoom, handleDisconnect, handleJoinRoom } from './socketHandlers.js';
import { surveyComplete, getLlmInstructions, submitUserMessages } from './gameHandler.js';

export function initializeSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: 'http://localhost:5173',
            methods: ['GET', 'POST']
        }
    });

io.on("connection", (socket) => {
//    console.log("Client connected:", socket.id);

    // when admin starts room or when user joins roomCode they are joined to this socket instance
    socket.on("join-room", async ({ roomCode, isAdmin, user }) => {
        handleJoinRoom(io, socket, {roomCode, isAdmin, user});
    });


    socket.on("show-instructions", async ({roomCode}) => {
        if (!roomCode) return;

        io.to(roomCode).emit("to-instructions");
    });


    // this triggers when admin starts game in roomManagement
    socket.on("start-game", async ({roomCode}) => {
        if (!roomCode) return;
        // this one will send users from waitingRoom to interactions page
        io.to(roomCode).emit("start-chat");
    });

    // when admin clicks start on roomManagment page it triggers the round to start and generate the instructions from the LLM
    socket.on("start-round", async ({ roomCode, round }) => {
        await getLlmInstructions(io, roomCode, round);
    });

        // this is called when user submits message on interaction page
    socket.on("submit-round-message", async ({ roomCode, userId, userName, text }) => {
        await submitUserMessages(io, roomCode, userId, userName, text);
    });


    // this triggers when admin clicks next on adminInteraction page
    socket.on("start-survey", ({roomCode}) => {
        if (!roomCode) return;
        // this sends user from interaction page to survey page
        io.to(roomCode).emit("start-user-survey");
    });

    // this disconnects users entirely from room if admin closes it while they're in it
    socket.on("close-room", ({ roomCode }) => {
        if(!roomCode) return;
        handleCloseRoom(io, roomCode);
    })

    socket.on("survey-complete", async ({ roomCode, userId, surveyId }) => {
        if (!roomCode) return;
        surveyComplete(io, roomCode, surveyId, userId);
    });

    // this is for if someone leaves the room while they're waiting
    socket.on("leave-room", () => {
        handleDisconnect(io, socket);
    });

    // also keeps track of users leaving a room
    socket.on("disconnect", () => {
        handleDisconnect(io, socket);
    });

    socket.on("connect_error", (err) => {
        console.error("Connection error:", err.message);
    });

    socket.on("connect_timeout", () => {
        console.error("Connection timed out:", socket.id);
    });
});

return io;
    
}