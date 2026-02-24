import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket"; 
import { updateUserIds, getRoom, updateStatus } from "../../services/roomsService";
import { setRole } from "../../services/usersService";
import games from "../gameLoader";

export default function RoomManagement() {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = location.state;
    const isAdmin = true;
    const [users, setUsers] = useState([]);
    const [room, setRoom] = useState("");
    // const [error, setError] = useState("");



    useEffect(() => {
        const handleConnect = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", {roomCode, isAdmin});
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }

        socket.on("status", (status) => {
            const currentPath = location.pathname;
            if(!currentPath.includes(status)) {
                navigate(`/admin/${status}`, { state: { roomCode } });
            }
        });

        socket.on("room-users", (userList) => {
            setUsers(userList);
        });
        
        socket.on("force-return-to-login", () => {
            navigate("/admin");
        })

        return () => {
            socket.off("connect", handleConnect);
            socket.off("status");
            socket.off("room-users");
            socket.off("force-return-to-login");
        };
    }, [socket]);


    useEffect(() => {
        retrieveRoom();
    }, [roomCode]);

    async function retrieveRoom() { 
        try {
            const response = await getRoom(roomCode);
            setRoom(response);
        } catch (error){
            console.error("Error:", error);
            // setError(error.message || "Something went wrong.");
        }
    }

    async function start() {
        const roomData = await getRoom(roomCode);
        const game = games.find(g => g.id === roomData.gameType)
        const gameRoles = game.roles;
        await assignRoles(users, gameRoles);
        socket.emit("show-instructions", { roomCode });
        let userIds = [];
        for (let i = 0; i < users.length; i++) {
            userIds.push(users[i].userId);
        }
        await updateUserIds(userIds, roomCode); // need to update this here to set user roles
        await updateStatus(roomCode, "instructions");
        navigate("/admin/instructions", { state: { roomCode }});

    }

    async function assignRoles(usersInRoom, gameRoles) {
        const shuffledRoles = [...gameRoles].sort(() => Math.random() - 0.5);
        for (let i = 0; i < usersInRoom.length; i++) {
            const user = usersInRoom[i];
            console.log("User in assignRoles", user);
            const roleToAssign = shuffledRoles[i];
            console.log("Role for user at", i, roleToAssign);
            try {
                const response = await setRole(user.userId, roleToAssign.id);
                console.log(response);
            } catch(error) {
                console.log(error.message);
            }
        }
    }


    const usersNeeded = room?.usersNeeded ?? 0;
    const canStart = users.length >= usersNeeded;
    const joinUrl = typeof window !== "undefined" ? window.location.origin : "https://localhost:5173";

    return (
        <div className="admin-container">
            <div className="room-management-card">
                <button
                    type="button"
                    className="back-to-rooms"
                    onClick={() => navigate("/admin")}
                >
                    Back to rooms
                </button>
                <h1>Room Management</h1>
                <div className="room-code-box">
                    <span className="room-code-value">{room?.roomCode ?? '—'}</span>
                </div>
                <p className="room-url">{joinUrl}</p>
                <div className="room-qr-wrap">
                    <p className="room-qr-label">Scan to join</p>
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`}
                        alt="QR Code"
                    />
                </div>
                <div className="users-box">
                    <h3>Participants</h3>
                    <p className="users-progress">{users.length} / {usersNeeded} joined</p>
                    <ul>
                        {(users || []).map((u, idx) => (
                            <li key={idx}>{u.userName}</li>
                        ))}
                    </ul>
                </div>
                <button
                    className="btn-primary-admin btn-full room-start-btn"
                    onClick={start}
                    disabled={!canStart}
                >
                    {canStart ? "Start session" : `Waiting for ${usersNeeded - users.length} more`}
                </button>
            </div>
        </div>
    )
}