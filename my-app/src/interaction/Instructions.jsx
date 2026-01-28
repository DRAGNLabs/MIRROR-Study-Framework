// main instructions will be on admin page but here we will have a page for the users with the role info
import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import games from "../gameLoader"
import { getRoom } from "../../services/roomsService";
import { useLocation, useNavigate } from "react-router-dom";

export default function Instructions() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = location.state;
    const roomCode = parseInt(user.roomCode);
    const isAdmin = false;
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {

        async function fetchRoom() {
            try {
                const roomData = await getRoom(roomCode);
                setGame(games.find(g => parseInt(g.id) === roomData.gameType));
            } catch (err) {
                console.error("Failed to fetch rom:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();

    }, [roomCode])

    useEffect(() => {
        if (!socket.connected) socket.connect();
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
    }, []);

    useEffect(() => {
        return () => {
            socket.emit("leave-room", { roomCode });
        };
    }, []);


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