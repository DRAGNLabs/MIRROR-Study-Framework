// main instructions will be on admin page but here we will have a page for the users with the role info
import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import games from "../gameLoader"
import { getRoom } from "../../services/roomsService";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserRole } from "../../services/usersService";

export default function Instructions() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = location.state;
    const roomCode = parseInt(user.roomCode);
    const isAdmin = false;
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {

        async function fetchData() {
            try {
                const roomData = await getRoom(roomCode);
                const { role } = await getUserRole(user.userId);
                const gameData = games.find(g => parseInt(g.id) === roomData.gameType);
                setUserRole(gameData.roles[parseInt(role) -1]);
            } catch (err) {
                console.error("Failed to fetch data:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();

    }, [roomCode])

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin, user });
        // if (!socket.connected) socket.connect();
        
        // const handleConnect = () => {
        //    socket.emit("join-room", { roomCode, isAdmin, user }); 
        // }

        // if (socket.connected) {
        //     handleConnect();
        // } else {
        //     socket.once("connect", handleConnect);
        // }
        // socket.on("connect", handleConnect);

        const onStart = () => {
            navigate("/interaction", { state: { user }});
        }

        socket.on("start-chat", onStart);

        socket.on("force-return-to-login", () => {
            navigate("/");
        });

        // const handleLeaveRoom = () => {
        //     socket.emit("leave-room", { roomCode });
        // };

        // window.addEventListener("beforeunload", handleLeaveRoom);

        return () => {
            // handleLeaveRoom();
            // window.removeEventListener("beforeunload", handleLeaveRoom);
            // socket.off("connect", handleConnect);
            socket.off("start-chat", onStart);
            socket.off("force-return-to-login");
        };
    }, []);

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);

        if (loading) {
            return (
                <div className="user-instruction-container">
                    <p>Loading your role...</p>
                </div>
            );
        }
        if (!userRole) {
            return (
                <div className="user-instruction-container">
                    <div className="user-instruction-card">
                        <h2>Look at Admin's Screen for General Instructions</h2>
                        <p className="subtext">
                            Follow the admin's instructions carefully. Your role could not be loaded—check with the admin if this persists.
                        </p>
                    </div>
                </div>
            );
        }
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
                    <h1>Role: {userRole.role}</h1>
                    <p>
                        <strong>Backstory:</strong> {userRole.backstory}
                    </p>
                </div>
            </div>
        </div>
    );
}