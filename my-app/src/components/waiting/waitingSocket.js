import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { socket } from '../../socket'

export function useRoomSocket(roomCode, isAdmin, user = null) {
    const navigate = useNavigate();
    const location = useLocation();
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const handleJoinRoom = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", { roomCode, isAdmin, user});
        }

        if (socket.connected) {
            handleJoinRoom();
        } else {
            socket.once("connect", handleJoinRoom);
        }

        socket.on("status", (status) => {
            const currentPath = location.pathname;
            const basePath = isAdmin ? "/admin" : "";
            const state = isAdmin ? { roomCode } : { user };
            if(!currentPath.includes(status)) {
                navigate(`${basePath}/${status}`, { state });
            }
        });

        socket.on("room-users", (userList) => {
            setUsers(userList);
        });

        socket.on("to-instructions", () => {
            if (!isAdmin) {
                navigate("/instructions", { state: { user }});
            }
        });

        socket.on("force-return-to-login", () => {
            socket.emit("leave-room"); // on admin side we didn't have this but idk why
            navigate(isAdmin ? "/admin" : "/");
        })

        return () => {
            socket.off("connect", handleJoinRoom);
            socket.off("status");
            socket.off("room-users");
            socket.off("to-instructions");
            socket.off("force-return-to-login");
        };
    }, [socket]);

    return { users };
}