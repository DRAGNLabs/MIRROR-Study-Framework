// main instructions will be on admin page but here we will have a page for the users with the role info
import { useState, useEffect } from "react";
import games from "../../gameLoader"
import { getRoom } from "../../services/roomsService";
import { useLocation } from "react-router-dom";
import { getUserRole } from "../../services/usersService";
import { socketListener } from "../common/socketListener";
import './instructions.css';

export default function Instructions() {
    const location = useLocation();
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

    socketListener(roomCode, isAdmin, user);


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