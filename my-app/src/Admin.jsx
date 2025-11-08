import { useState, useRef } from "react";
import { getCreatedRooms, sendCreatedRoom } from "../services/apiService";

export function Admin() {
    const [roomCreated, setRoomCreated] = useState(false);
    const [start, setStart] = useState(true);
    const [count, setCount] = useState(0);
    const [selectedGames, setSelectedGames] = useState([]);
    const inputRef = useRef();
    const [newRoomCode, setNewRoomCode] = useState(null);
    const [ error, setError] = useState("");

    async function createRoom() { //changes the page to customize the room
        const newRoomCode = generateRoomCode();
        setNewRoomCode(newRoomCode);
        setStart(false);
        setRoomCreated(true);
    }

    async function buildRoom() { //sends the room into the backend
        try {
            const response = await sendCreatedRoom(newRoomCode, count, selectedGames);
            const rooms = await getCreatedRooms();
            console.log(rooms.tables);
            setStart(true);
            setRoomCreated(false);
        } catch (error){
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");

        }

    }

    async function closeRoom() {
        setRoomCreated(false);
        setSelectedGames([]);
        setStart(true);
    }

    function generateRoomCode() { // Generates a random number between 100000 and 999999
  
        //ensure this generated roomCode has not already been used
        return Math.floor(100000 + Math.random() * 900000);
    }


    function toggleGame(gameName) {
        setSelectedGames(prev =>
            prev.includes(gameName)
                ? prev.filter(g => g !== gameName)
                : [...prev, gameName]
        );
    }

    return (
        <div className="admin-container">
            {start && (
                <div className="admin-buttons">
                    <button onClick={createRoom}>Create Room</button>

                </div>
            )}
            
            {roomCreated && (
                <div className="room-info">
                    
                    <p className="label"><strong>Generated Room Code: </strong> {newRoomCode}</p>

                    {/* You can put the actual room code here later */}

                    <p className="label-inline"><strong>Users allowed in room: </strong>
                    <input
                        className="text-input small"
                        type="number"
                        value={count}
                        ref={inputRef}
                        onChange={(e) => setCount(e.target.value)}
                        placeholder="3"
                        required
                    />
                    </p>
                    <div className="games-section">
                    <p className="games-label"><strong>Select games:</strong></p>
                    <div className="games-options">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={selectedGames.includes("One")}
                                onChange={() => toggleGame("One")}
                            />
                            <span>One</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={selectedGames.includes("Two")}
                                onChange={() => toggleGame("Two")}
                            />
                            <span>Two</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={selectedGames.includes("Three")}
                                onChange={() => toggleGame("Three")}
                            />
                            <span>Three</span>
                        </label>
                    </div>
                    </div>

                    <p className="selected-display">
                        Selected: {selectedGames.join(", ") || "None"}
                    </p>
                    <button onClick={buildRoom}>Save Room</button>
                </div>

            )}

        </div>
    );
}

export default Admin;
