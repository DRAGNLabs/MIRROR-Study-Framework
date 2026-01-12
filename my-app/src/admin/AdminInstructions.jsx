import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom } from "../../services/roomsService";
import game1 from "../games/game1.json";
import game2 from "../games/game2.json";
import game3 from "../games/game3.json";

const gameMap = { // we need to find a better way to access the games then just doing this multiple times also having to import each game individually is not a good idea
    1: game1,
    2: game2, 
    3: game3
}

export default function AdminInstructions() {
    const navigate = useNavigate();
    const location = useLocation();
    const { roomCode } = location.state;
    const [room, setRoom] = useState(null);
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [instructions, setInstructions] = useState("");
    // const room = await getRoom(roomCode);
    // const game = gameMap[room.gameType];

    useEffect(() => {
        async function fetchRoom() {
            try {
                const roomData = await getRoom(roomCode);
                setRoom(roomData);
                setGame(gameMap[roomData.gameType]);
            } catch (err) {
                console.error("Failed to fetch rom:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();
        console.log(game);

    }, [roomCode])

    async function toInteractions() {
        socket.emit("start-game", { roomCode });
        // let userIds = [];
        // for (let i = 0; i < users.length; i++) {
        //     userIds.push(users[i].userId);
        // }
        // await updateUserIds(userIds, roomCode);
        socket.emit('start-round', {
            roomCode,
            round: 1
        });
        navigate("/admin/adminInteraction", { state: { roomCode } }); // will need to update this once next merge pull request happens (I changed endpoint to /admin/interactions or something like that)
    }
    
    if(loading) {
        return <p> Loading instructions...</p>;
    }
    return(
        <div className="admin-container">
        <h1>Instructions</h1>
            {/* <p> some temporary instructions...</p> */}
            <p>Game Instructions: {game.instructions}</p>
            <div className="admin-next-bottom-left">
                <button onClick={toInteractions}>Next</button>
            </div>
        </div>
    )
}