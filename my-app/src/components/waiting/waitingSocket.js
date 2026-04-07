import { useEffect, useState } from "react";
import { socket } from '../../socket'
import { socketListener } from "../common/socketListener";

export function useRoomSocket(roomCode, isAdmin, user = null) {
    const [users, setUsers] = useState([]);

    socketListener(roomCode, isAdmin, user);

    useEffect(() => {
        socket.on("room-users", (userList) => {
            setUsers(userList);
        });

        return () => {
            socket.off("room-users");
        }
    }, [socket]);

    return { users };
}