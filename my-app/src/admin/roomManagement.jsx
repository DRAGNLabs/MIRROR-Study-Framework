import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket"; 
import { updateUserIds, getRoom } from "../../services/roomsService";

export default function RoomManagement() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [room, setRoom] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const isAdmin = true;
    const { roomCode } = location.state;

    useEffect(() => {
        if (!roomCode) {
            navigate("/admin", { replace: true});
            return;
        }
    }, [roomCode, navigate]);

    useEffect(() => {
        retrieveRoom();
    }, [roomCode]);

    useEffect(() => {

        socket.emit("join-room", { roomCode, isAdmin});

        socket.on("room-users", setUsers); 

        return () => {
            socket.off("room-users");
        };
  
    }, []);


    async function retrieveRoom() { 
        try {
            const response = await getRoom(roomCode);
            setRoom(response);
        } catch (error){
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");
        }
    }

    async function start() {
        socket.emit("start-game", { roomCode });
        let userIds = [];
        for (let i = 0; i < users.length; i++) {
            userIds.push(users[i].userId);
        }
        await updateUserIds(userIds, roomCode);
        socket.emit('start-round', {
            roomCode,
            round: 1
        });
        navigate("/admin/adminInteraction", { state: { roomCode } });
    }


    return (
        <div className="admin-container">
        <h1>Room Management</h1>
        <h2>Room Code: {room.roomCode}</h2>
                <p>https://localhost:5173</p> 
             <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://dragn.ai"
                alt="QR Code"
                style={{ marginTop: "20px" , marginBottom: "20px"}}
            />
                <div className="users-box">
                    <h3>Users in Room:</h3>
                    <ul>
                        {(users || []).map((u, idx) => (
                         <li key={idx}>{u.userName}</li>
                        ))}
                    </ul>
                </div>

            <button onClick={start} disabled={users.length < room.count && users.length < 3}>Start</button>
        </div>
    )
}