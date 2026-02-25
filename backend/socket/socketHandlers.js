import { getRoom } from '../services/roomsService.js';

const usersInRoom = {};
const socketUserMap = {};

export async function handleJoinRoom(io, socket, { roomCode, isAdmin, user }) {
    if(!roomCode || typeof roomCode !== 'number') {
        console.warn("join-room missing or invalid roomCode", roomCode, isAdmin, user);
        return;
    } 

    if(!usersInRoom[roomCode]) {
        usersInRoom[roomCode] = [];
    }

    const currSocket = socketUserMap[socket.id];
    if (currSocket) {
        const socketRoomCode = currSocket.roomCode;
        if (socketRoomCode == roomCode) {
            return; // can't join room twice with same socket id
        }
    }

    socket.join(roomCode);
    socketUserMap[socket.id] = { roomCode, isAdmin, user }; // should I track admin here?
    if (!isAdmin) {
        const alreadyInRoom = usersInRoom[roomCode].some((u) => u.userId === user.userId);
        if (!alreadyInRoom) {
            usersInRoom[roomCode].push(user);
        } 
    }
    // send updated user list
    io.to(roomCode).emit("room-users", usersInRoom[roomCode]);

    try {
        const room = await getRoom(roomCode);
        // send user/admin to correct status page
        io.to(roomCode).emit("status", room.status);
    } catch (err) {
        console.error("join-room: failed to fetch room for roomCode", roomCode, err?.message || err);
        return;
    }

    console.log(isAdmin ? "Admin joined room:" : "User joined room:", roomCode, socket.id);
}


export async function handleDisconnect(io, socket) {
        const data = socketUserMap[socket.id]
        if (!data)  return; //basically if not part of a room

        const { roomCode, isAdmin, user } = data
        // if(!rooms[roomCode]) {
        //     return;
        // }
        
        if(!isAdmin && user && usersInRoom[roomCode]) {
            usersInRoom[roomCode] = usersInRoom[roomCode].filter((u) => u.userId !== user.userId);
            io.to(roomCode).emit("room-users", usersInRoom[roomCode]);
        }

        // Clean up mapping
        socket.leave(roomCode);
        delete socketUserMap[socket.id];
        if (isAdmin) {
            console.log("Admin disconnected:", socket.id);
        } else {
            console.log("User disconnected:", socket.id, user.userName);
        }
}

export function handleCloseRoom(io, roomCode) {
    io.to(roomCode).emit("force-return-to-login");
    const clients = io.sockets.adapter.rooms.get(roomCode);
    if (clients) {
        clients.forEach(clientId => {
            const clientSocket = io.sockets.sockets.get(clientId);
            clientSocket.leave(roomCode); // remove from room
        });
    }
    delete usersInRoom[roomCode];
}