// main instructions will be on admin page but here we will have a page for the users with the role info
import { useState, useEffect, useRef } from "react";
import { socket } from "../socket"; 
import game1 from "../games/game1.json";
import game2 from "../games/game2.json";
import game3 from "../games/game3.json";
import { useLocation, useNavigate } from "react-router-dom";

const gameMap = { // we need to find a better way to access the games then just doing this multiple times also having to import each game individually is not a good idea
    1: game1,
    2: game2, 
    3: game3
}

export default function Instructions() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = location.state;
    const roomCode = parseInt(user.roomCode);
    const isAdmin = false;

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin, user });

        const onStart = () => {
            navigate("/interaction", { state: { user }});
        }

        socket.on("start-chat", onStart);

        socket.on("force-return-to-login", () => {
            navigate("/");
        });

        return () => {
            socket.off("start-chat", onStart);
            socket.off("force-return-to-login");
        };
    }, [roomCode]);

    // instructions are hardcoded for now since we don't have role functionality yet, will update that once we implement role functionality
        return (
        <div className="user-instruction-container">
            <div className="user-instruction-card">
                <h2>Look at Admin's Screen for General Instructions</h2>
                <p className="subtext">
                    Follow the admin’s instructions carefully. Your role gives you
                    specific goals and limitations.
                </p>

                <div className="role-box">
                    <h1>Role: Shepherd</h1>

                    <p>
                        <strong>Backstory:</strong> People keep scattering your flock.
                    </p>

                    <p>
                        <strong>Drawbacks:</strong> You’re allergic to sheep.
                    </p>
                </div>
            </div>
        </div>
    );
}