import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { socket } from "../../socket"; 
import { getUser } from "../../services/usersService";
import { sendRoom, closeARoom, validRoomCode, getRoom, getOpenRooms, roomStarted, updateStatus, completedRooms as fetchCompletedRooms } from "../../services/roomsService";
import games from "../../gameLoader";
import './admin.css';


export function Admin() {
    const [roomCreated, setRoomCreated] = useState(false);
    // For when you're deleting a room and you are in the process of confirming the delete
    const [roomPendingDelete, setRoomPendingDelete] = useState(null);
    const [start, setStart] = useState(true);
    const [count, setCount] = useState(3);

    const [selectedGame, setSelectedGame] = useState(null);
    const [selectedModel, setSelectedModel] = useState("gpt-4o");
    const inputRef = useRef();
    const [newRoomCode, setNewRoomCode] = useState(null);
    // Stores the list of completed rooms from the db
    const [completedRoomList, setCompletedRoomList] = useState([]);
    // const [ error, setError] = useState("");
    const [roomUsers, setRoomUsers] = useState({});
    // When true shows the completed rooms page.
    const [completed, setCompleted] = useState(false);

    const [ rooms, setRooms ] = useState([]);

    const navigate = useNavigate();
    const isAdmin = true;

    const location = useLocation();


    async function showCompletedRooms() {
      try {
        const data = await fetchCompletedRooms();
        setCompletedRoomList(data);
        setCompleted(true);
        setStart(false);
        setRoomCreated(false);
      } catch (error) {
        console.error("Error loading completed rooms:", error);
      }
    }

    async function init(){
        const rooms = await getOpenRooms();
        setRooms(rooms);
    }

    function getGameById(id) {
        return games.find(g => g.id === id);
    }

    async function loadUsersForRoom(room) {
        const userIds = room.userIds ?? "[]";
        if (userIds.length === 0) return;

        try {
            const users = await Promise.all(
                userIds.map(id => getUser(id))
            );

            const usernames = users.map(u => u.userName);

            setRoomUsers(prev => ({
                ...prev,
                [room.roomCode]: usernames
            }));
        } catch (err) {
            console.error("Failed to load users for room", room.roomCode, err);
        }
    }


    useEffect(() => { 
        init();
        const isAuth = sessionStorage.getItem("admin");

        if(!isAuth){
            navigate("/adminLogin");
        } else {
            init();
        }
    }, []);

    useEffect(() => {
        rooms.forEach(room => {
            if (room.started) {
                loadUsersForRoom(room);
            }
        });
    }, [rooms]);

    useEffect(() => {
        completedRoomList.forEach((room) => {
          loadUsersForRoom(room);
        });
      }, [completedRoomList]);

    /** Navigating back from the room details page it'll take you back where you were. */
    useEffect(() => {
      if (location.state?.showCompletedRooms === true) {
        showCompletedRooms();
      }
    }, [location.state?.showCompletedRooms]);

    
    async function createRoom() { //changes the page to customize the room
        setCompleted(false);
        const newRoomCode = await generateRoomCode();
        setNewRoomCode(newRoomCode);
        setStart(false);
        setRoomCreated(true);
    }

    async function activeRoomsDisplay(){
      setCompleted(false);
      setStart(true);
      setRoomCreated(false);
    }

    async function completedRooms(){
      setCompleted(true);
    }

    async function buildRoom() { //sends the room into the backend
        try {
            const gameData = games.find(g => g.id === selectedGame);
            const response = await sendRoom(newRoomCode, selectedGame, gameData.rounds, count, selectedModel); 
            const rooms = await getOpenRooms();
            setRooms(rooms);
            setStart(true); // what does setStart do?
            setRoomCreated(false); // what is the point of setRoomCreated?
        } catch (error){
            console.error("Error:", error);
            // setError(error.message || "Something went wrong."); // at what point is there not going to be error.message, also why setError?

        }

    }

    async function closeRoom(roomCode) { // esentially closeRoom should be blocked once admin opens it
        const roomCurr = await getRoom(roomCode);
        if (roomCurr.status === "survey") {
            alert("You can't close the room it is in survey status");
            return;
        }
        try {
            const response = await closeARoom(roomCode);
            socket.emit("close-room", { roomCode });
            setRooms(await getOpenRooms());
        } catch (error) {
            console.error("Error:", error);
            // setError(error.message || "Something went wrong.");
        }
        setRoomCreated(false);
        setSelectedGame(null);
        setStart(true);
    }

    async function startRoom(roomCode) {
        try {
            await roomStarted(roomCode);
            const room = await getRoom(roomCode);
  
            const status = room.status;
            if (status === "waiting") {
                navigate("/admin/waiting", { state: { roomCode }});
            } else if (status === "instructions") {
                navigate("/admin/instructions", { state: { roomCode }});
            } else if (status === "interaction") {
                navigate("/admin/interaction", { state: { roomCode }});
            } else if (status === "survey") {
                navigate("/admin/survey", { state: { roomCode }});
            } else {
                await updateStatus(roomCode, "waiting");
                navigate("/admin/waiting", { state: { roomCode }});
            }
        } catch(error) {
            console.error("Error:", error);
            // setError(error.message || "Something went wrong.");
        }
    }

    async function generateRoomCode() { // Generates a random number between 100000 and 999999
        //ensure this generated roomCode has not already been used
        while (true){
            const roomCode = Math.floor(100000 + Math.random() * 900000);
            if(await validRoomCode(roomCode)){
                return roomCode
            }
        }

    }

    async function confirmDeleteCompletedRoom() {
      if (!roomPendingDelete) return;

      try {
        setCompletedRoomList((prev) =>
          prev.filter((r) => r.roomCode !== roomPendingDelete.roomCode)
        );
        closeARoom(roomPendingDelete.roomCode);
        setRoomPendingDelete(null);
      } catch (error) {
        console.error("Error deleting room:", error);
      }
    }


return (
  <div className="admin-container admin-dashboard">
    <div className="admin-top">
      <button className="btn-primary-admin" onClick={activeRoomsDisplay}>
        Rooms
      </button>
      <button className="btn-primary-admin" onClick={showCompletedRooms}>
        Completed Rooms
      </button>
      <button className="btn-primary-admin" onClick={createRoom}>
        Create Room
      </button>
      
    </div>

    {!completed ? (
    <>
      {start && rooms && (
        <div className="rooms-grid">
          <h2 className="rooms-section-title">Your rooms</h2>
          <p className="rooms-section-subtitle">
            Select a room to start or create a new one
          </p>

          <div className="rooms-container">
            {rooms.map((room) => {
              const game = getGameById(room.gameType);
              const status = room.status;

              return (
                <div className="room-display" key={room.roomCode}>
                  <span className="room-code-badge">{room.roomCode}</span>

                  <div className="room-meta">
                    <span className="meta-item"><strong>{game ? game.title : "Unknown"}</strong></span>
                    <span className="meta-item">{room.modelType}</span>
                    <span className="meta-item">Needs {room.usersNeeded} user(s)</span>
                    <span className="meta-item">Started: {room.started ? "✅" : "❌"}</span>
                    {status && ( <span className={`meta-item`}>Status: {status}</span> )}

                    {Array.isArray(roomUsers?.[room.roomCode]) && (
                      <span className="meta-item users">
                        Users: {roomUsers[room.roomCode].join(", ")}
                      </span>
                    )}
                  </div>

                  <div className="room-display-actions">
                    <button
                      className="btn-primary-admin"
                      onClick={() => startRoom(room.roomCode)}
                    >
                      Start
                    </button>
                    <button
                      className="btn-secondary-admin"
                      onClick={() => closeRoom(room.roomCode)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roomCreated && (
        <div className="room-info">
          <h3 className="room-info-section">Room details</h3>
          <div className="room-code-highlight">{newRoomCode}</div>

          <h3 className="room-info-section">Participants</h3>
          <div className="label-inline">
            <label>Users allowed</label>
            <input
              className="text-input small"
              type="number"
              min={1}
              value={count}
              ref={inputRef}
              onChange={(e) => setCount(e.target.value)}
              required
            />
          </div>

          <h3 className="room-info-section">Game</h3>
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
                <span className="radio-mark" />
                <span>{game.title}</span>
              </label>
            ))}
          </div>

          <h3 className="room-info-section">Model</h3>
          <div className="model-select">
            <div className="model-select-header">
              <label htmlFor="modelType" className="model-select-label">
                ChatGPT model
              </label>
              <p className="model-select-helper">
                Choose which ChatGPT model this session will use.
              </p>
            </div>
            <div className="model-select-control">
              <select
                id="modelType"
                className="model-select-input"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="gpt-4o">gpt-4o (default)</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-5.2-chat-latest">gpt-5.2-chat-latest</option>
              </select>
            </div>
          </div>

          <button
            className="btn-primary-admin btn-full"
            onClick={buildRoom}
            disabled={!selectedGame}
          >
            Save room
          </button>
        </div>
      )}
      </>
    ): (
      <div className="rooms-grid">
        <h2 className="rooms-section-title">Completed Rooms</h2>
          <p className="rooms-section-subtitle">Completed room data here.</p>
        <div className="rooms-container">
          {Array.isArray(completedRoomList) && completedRoomList.length > 0 ? (
            completedRoomList.map((room) => (
              <div className="room-display" key={room.roomCode}>
                <span className="room-code-badge">Room Code: {room.roomCode}</span>

                <div className="room-meta">
                  <span className="meta-item">
                    Users: {Array.isArray(roomUsers?.[room.roomCode])
                      ? roomUsers[room.roomCode].join(", ")
                      : "Loading..."}
                  </span>
                  
                  <span className="meta-item">Model used: {room.modelType}</span>
    
                </div>

                <div className="room-actions">
                  <button className="btn-primary-admin" onClick={() => navigate(`/admin/completed-room/${room.roomCode}`)}>View</button>
                  <button className="btn-secondary-admin"  onClick={() => setRoomPendingDelete(room)}>Delete</button>
                </div>
              </div>
            ))
          ) : (
            <p>No completed rooms found.</p>
          )}
        </div>
      </div>
    )
    }
      {roomPendingDelete && (
    <div className="modal-backdrop">
      <div className="confirm-modal-card">
        <h3 className="confirm-modal-title">Delete completed room?</h3>
        <p className="confirm-modal-text">
          Are you sure you want to delete room{" "}
          <strong>{roomPendingDelete.roomCode}</strong>?
        </p>
        <p className="confirm-modal-subtext">
          This action cannot be undone.
        </p>

        <div className="confirm-modal-actions">
          <button
            className="btn-secondary-admin"
            onClick={() => setRoomPendingDelete(null)}
          >
            Cancel
          </button>
          <button
            className="btn-danger-admin"
            onClick={confirmDeleteCompletedRoom}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )}
  </div>
);
}

export default Admin;