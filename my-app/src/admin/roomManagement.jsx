import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket"; 
import { updateUserIds, getRoom } from "../../services/roomsService";
// import game1 from "../games/game1.json";
// import game2 from "../games/game2.json";
// import game3 from "../games/game3.json";

// const gameMap = {
//     1: game1,
//     2: game2, 
//     3: game3
// }

export default function RoomManagement() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [room, setRoom] = useState("");
    const [error, setError] = useState("");
    // const [gameInfo, setGame] = useState(null);
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
        // loadGame();

        socket.emit("join-room", { roomCode, isAdmin});

        // socket.on("room-users", (userList) => { // why do we need this?
        //     setUsers(userList);
        // });
        socket.on("room-users", setUsers); // testing this out

        return () => {
            socket.off("room-users");
        };
  
    }, []);


    async function retrieveRoom() { 
        try {
            const response = await getRoom(roomCode);
            // console.log(response);
            setRoom(response);
        } catch (error){
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");
        }
    }

    // async function loadGame(){
    //     const roomInfo = await getRoom(parseInt(roomCode));
    //     const gameNumber = roomInfo.gameType; //this should change when we change the database storing the 1 game that was selected.
    //     const selectedGame = gameMap[gameNumber];
    //     setGame(selectedGame);
    // }

    async function start() {
        console.log("In start function!");
        socket.emit("startGame", { roomCode });
        let userIds = [];
        for (let i = 0; i < users.length; i++) {
            console.log(users[i]); // debugging to make sure we got all the users right
            userIds.push(users[i].userId);
        }
        await updateUserIds(userIds, roomCode);
        socket.emit('start-round', {
            roomCode,
            round: 1
            // prompt: gameInfo["prompts"][0]["instruction_system"]
        });
        //  socket.emit("generate-ai", {
        //     roomCode,
        //     prompt: selectedGame.instruction_system
        // });
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