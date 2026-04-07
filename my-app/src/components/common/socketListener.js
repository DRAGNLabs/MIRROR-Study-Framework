import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from "../../socket";

// basic socket events in every component
export function socketListener(roomCode, isAdmin, user) {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const handleConnect = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", {roomCode, isAdmin, user});
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }

        socket.on("force-return-to-login", () => {
            socket.emit("leave-room");
            navigate(isAdmin ? "/admin" : "/");
        });

        socket.on("change-status", ({ status }) => {
            if (isAdmin) {
                navigate(`admin/${status}`, { state: { roomCode }});
            } else {
                navigate(`/${status}`, { state: { user }})
            }
        });

        return () => {
            socket.off("connect", handleConnect);
            socket.off("force-return-to-login");
            socket.off("change-status");
        }
    }, [roomCode, isAdmin, user, socket]);
    
}