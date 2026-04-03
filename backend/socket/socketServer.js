import { Server } from 'socket.io';
import { handleCloseRoom, handleDisconnect, handleJoinRoom } from './socketHandlers.js';
import { surveyComplete, getLlmInstructions, submitUserMessages, deleteTimer } from './gameHandler.js';

export function initializeSocketServer(httpServer, corsOrigin) {
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
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

    socket.on('startTimer', () => {

        endTime = Date.now() + totalTime;
        io.sockets.emit('timerStarted', { endTime: endTime });

        const timerInterval = setInterval(() => {
        const timeLeft = endTime - Date.now();
        if (timeLeft <= 0) {
            io.sockets.emit('timerEnded');
            clearInterval(timerInterval);
        } else {
            io.sockets.emit('timeUpdate', { timeLeft: timeLeft });
        }
        }, 1000); 
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
        deleteTimer(roomCode);
        handleCloseRoom(io, roomCode);
    })

    socket.on("survey-complete", async ({ roomCode, userId }) => {
        if (!roomCode) return;
        surveyComplete(io, roomCode, userId);
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

    socket.on("delete-room", ({roomCode}) => {
        deleteTimer(roomCode);
    });
});

return io;
    
}