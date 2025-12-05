import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket"; 
import { updateUserIds, getRoom } from "../../services/roomsService";


export default function RoomManagement() {
    const location = useLocation();
    const { room } = location.state;
    if (!room) {
        console.log("Room not passed through state to roomManagement room")
        navigate("/admin", { replace: true });
        return null;
    }
    const roomCode = String(room.roomCode);
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();
    const isAdmin = true;

    // FOR LATER: might consider having this function instead of just sending room through state if room is changing a lot but it is not needed now
    // async function retrieveRoom() { 
    //     try {
    //         const response = await getRoom(roomCode);
    //     } catch (error){
    //         console.error("Error:", error);
    //         setError(error.message || "Something went wrong.");
    //     }

    // }

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin});

        socket.on("room-users", (userList) => {
            setUsers(userList);
        });

        return () => {
            socket.off("room-users");
        };
  
    }, []);

    async function start() {
        console.log("In start function!");
        socket.emit("startGame", { roomCode });
        let userIds = []
        for (let i = 0; i < users.length; i++) {
            userIds.push(users[i].userId);
        }
        await updateUserIds(userIds, roomCode);
        navigate("/admin/adminInteraction", { state: { room } });
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