import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { socket } from "../socket"; 
import { sendRoom, closeARoom, validRoomCode, getRoom, getOpenRooms, roomStarted, updateStatus } from "../../services/roomsService";
import games from "../gameLoader";

export function Admin() {
    const [roomCreated, setRoomCreated] = useState(false);
    const [start, setStart] = useState(true);
    const [count, setCount] = useState(3);
    const [selectedGame, setSelectedGame] = useState(null);
    const inputRef = useRef();
    const [newRoomCode, setNewRoomCode] = useState(null);
    const [ error, setError] = useState("");
    const [ rooms, setRooms ] = useState([]);
    const [deletingRoom, setDeletingRoom] = useState(null);
    const [valid, setValid] = useState(false);
    const location = useLocation();
    const validLogin = location.state?.isValid;
    const navigate = useNavigate();
    const isAdmin = true;



    async function init(){
        const rooms = await getOpenRooms();
        setRooms(rooms);
    }

    useEffect(() => { 
        init();
        const isAuth = sessionStorage.getItem("admin");

        if(!isAuth){
            navigate("/adminLogin");
        } else {
            init();
            setValid(true);
        }
    }, []);

    
    async function createRoom() { //changes the page to customize the room
        const newRoomCode = await generateRoomCode();
        setNewRoomCode(newRoomCode);
        setStart(false);
        setRoomCreated(true);
    }

    async function buildRoom() { //sends the room into the backend
        try {
            const gameData = games.find(g => g.id === selectedGame);
            const response = await sendRoom(newRoomCode, selectedGame, gameData.rounds, count); 
            const rooms = await getOpenRooms();
            setRooms(rooms);
            setStart(true); // what does setStart do?
            setRoomCreated(false); // what is the point of setRoomCreated?
        } catch (error){
            console.error("Error:", error);
            setError(error.message || "Something went wrong."); // at what point is there not going to be error.message, also why setError?

        }

    }

    async function closeRoom(roomCode) { // esentially closeRoom should be blocked once admin opens it
        const roomCurr = await getRoom(roomCode);
        if (roomCurr.status === "survey") {
            alert("You can't close the room it is in survey status");
            return;
        }
        try {
            setDeletingRoom(roomCode);
            const response = await closeARoom(roomCode);
            socket.emit("close-room", { roomCode });
            setRooms(await getOpenRooms());
            // setRooms(prev => prev.filter(r => r.roomCode !== roomCode));           
            

        } catch (error) {
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");
        }
        setRoomCreated(false);
        setSelectedGame(null);
        setStart(true);
    }

    async function startRoom(roomCode) {
        try {
            await roomStarted(roomCode);
            const room = await getRoom(roomCode);
            if(room.status !== "survey" && room.status !== "interaction" && room.status!== "instructions") {
               await updateStatus(roomCode, "waiting"); 
            }
            navigate("/admin/waiting", { state: { roomCode }}); // this is probably fine to pass room for now
        } catch(error) {
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");
        }
    }

    async function generateRoomCode() { // Generates a random number between 100000 and 999999
  
        //ensure this generated roomCode has not already been used
        while (true){
            const roomCode = Math.floor(100000 + Math.random() * 900000);
            if(await validRoomCode(roomCode)){
                console.log(roomCode);
                return roomCode
            }
        }

    }



    return (
    <div className="admin-container">

        <div className="admin-top">
            <button onClick={createRoom}>Create Room</button>
        </div>

        {start && rooms && (
            <div className="rooms-grid">
                <h1>Created rooms:</h1>

                <div className="rooms-container">
                    {rooms.map(room => (
                        <div className="room-display" key={room.roomCode}>
                            <p>Room Code: {room.roomCode}</p>
                            <p>Users needed per room: {room.usersNeeded}</p>
                            <p>Selected Game: {room.gameType}</p>
                            <p>Started: {room.started}</p>
                            {/* <p>Users in room: {JSON.parse(room.users).length}</p> */}
                            <button onClick={() => startRoom(room.roomCode)}>Start Room</button>
                            <button onClick={() => closeRoom(room.roomCode)}>Close Room</button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {roomCreated && (
            <div className="room-info">
                <p className="label"><strong>Generated Room Code: </strong> {newRoomCode}</p>

                <p className="label-inline">
                    <strong>Users allowed in room: </strong>
                    <input
                        className="text-input small"
                        type="number"
                        min={1}
                        value={count}
                        ref={inputRef}
                        onChange={(e) => setCount(e.target.value)}
                        placeholder="3"
                        required
                    />
                </p>

                <div className="games-section">
                    <p className="games-label"><strong>Select game:</strong></p>

                    <div className="games-options">

                        {games.map((game) => (
                            <label key={game.id} className="custom-radio">
                                <input
                                    type="radio"
                                    name="game"
                                    value={game.id}
                                    checked={selectedGame === game.id}
                                    onChange={() => setSelectedGame(game.id)}
                                />
                                <span className="radio-mark"></span>
                                <span>{game.title}</span>
                            </label>
                        ))}

                    </div>
                </div>


                <button onClick={buildRoom} disabled={!selectedGame}>Save Room</button>
            </div>
        )}

    </div>
)
}
export default Admin;