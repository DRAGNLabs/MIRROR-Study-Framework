import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../../socket";
import { updateUserIds, getRoom, updateStatus } from "../../../services/roomsService";
import { setRole } from "../../../services/usersService";
import games from "../../gameLoader";
import { useRoomSocket } from "./waitingSocket";
import { UserList } from "./UserList";
import './waiting.css';

export default function RoomManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomCode } = location.state;
  const [room, setRoom] = useState("");
  
  const { users } = useRoomSocket(roomCode, true);

  useEffect(() => {
    retrieveRoom();
  }, [roomCode]);

  async function retrieveRoom() {
    try {
      const response = await getRoom(roomCode);
      setRoom(response);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function start() {
    const roomData = await getRoom(roomCode);
    const game = games.find(g => g.id === roomData.gameType);
    const gameRoles = game.roles;
    await assignRoles(users, gameRoles);
    socket.emit("navigate-users", { roomCode, status: "instructions" });
    
    const userIds = users.map(u => u.userId);
    await updateUserIds(userIds, roomCode);
    await updateStatus(roomCode, "instructions");
    navigate("/admin/instructions", { state: { roomCode } });
  }

  async function assignRoles(usersInRoom, gameRoles) {
    const shuffledRoles = [...gameRoles].sort(() => Math.random() - 0.5);
    for (let i = 0; i < usersInRoom.length; i++) {
      const user = usersInRoom[i];
      const roleToAssign = shuffledRoles[i];
      try {
        await setRole(user.userId, roleToAssign.id);
      } catch (error) {
        console.err(error.message);
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
        
        <UserList users={users} usersNeeded={usersNeeded} variant="admin" />
        
        <button
          className="btn-primary-admin btn-full room-start-btn"
          onClick={start}
          disabled={!canStart}
        >
          {canStart ? "Start session" : `Waiting for ${usersNeeded - users.length} more`}
        </button>
      </div>
    </div>
  );
}
