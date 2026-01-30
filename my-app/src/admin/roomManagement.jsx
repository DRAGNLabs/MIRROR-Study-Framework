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
        socket.emit("join-room", {roomCode, isAdmin});
        // if (!socket.conected) socket.connect();

        // const handleConnect = () => {
        //     socket.emit("join-room", {roomCode, isAdmin});
        // }

        // socket.on("connect", handleConnect);

        // if (socket.connected) {
        //     handleConnect();
        // } else {
        //     socket.once("connect", handleConnect);
        // }

        socket.on("status", (status) => {
            const currentPath = location.pathname;
            if(currentPath.includes(status)) {
                return;
            } else {
                navigate(`/admin/${status}`, { state: { roomCode } });
            }
        });

        // socket.on("room-users", setUsers);
        socket.on("room-users", (userList) => {
            setUsers(userList);
        });
        
        socket.on("force-return-to-login", () => {
            navigate("/admin");
        })

        // const handleLeaveRoom = () => {
        //     socket.emit("leave-room", { roomCode });
        // };

        // window.addEventListener("beforeunload", handleLeaveRoom);

        return () => {
            // handleLeaveRoom();
            // window.removeEventListener("beforeunload", handleLeaveRoom);
            // socket.off("connect", handleConnect);
            socket.off("status");
            socket.off("room-users");
            socket.off("force-return-to-login");
        };
  
    }, [roomCode]);

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);


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

            <button onClick={start} disabled={users.length < room.usersNeeded}>Start</button>
        </div>
    )
}