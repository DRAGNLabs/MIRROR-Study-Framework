import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from "../../socket";

// basic socket events in every component
export function socketListener({ roomCode, isAdmin, user }) {
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

        // should replace to-instructions, start-chat, start-user-survey
        socket.on("change-status", ({ status }) => {
            const basePath = isAdmin ? "/admin" : "";
            navigate(`${basePath}/${status}`);
        });
        /*
        idea is to make one socket event that admins call to renavigate users, 
        so that would get rid of to-instructions, start-chat, start-user-survey and create one shared one

        Waiting room:
            room-users: updates room list
                to-instructions: navigates user to instructions
        Instructions: 
                start-chat: navigates user to interactions
        Interactions:
            receive-message: receives instructions & end messages (and user messages in multi turn later)
            all-user-messages: inputs all user messages before llm response
            @ai-start: next 3 are ai streaming
            @ai-token
            @ai-end
            round-complete: resets variables and loads room
            @timer-start: starts & updates timer for user/admin 
            @timer-expired: lets user/admin know timer is expired

            User:
                start-user-survey: navigate user to survey
            instructions-complete: also resets variables to allow users to send info (don't need this maybe?)
            game-complete: also resets variables and loads room (don't know if we need this)
        Survey:
            user-survey-complete: only on admin side, basically updates survey map
        */

        return () => {
            socket.off("connect", handleConnect);
            socket.off("force-return-to-login");
            socket.off("change-status");
        }
    }, [roomCode, isAdmin, user, socket]);
    
}