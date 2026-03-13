import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom } from "../../services/roomsService";
import { getUser } from "../../services/usersService";

export function CompletedRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [usernames, setUsernames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoom() {
      try {
        const roomData = await getRoom(roomCode);
        setRoom(roomData);

        const userIds = roomData?.userIds ?? [];
        if (userIds.length > 0) {
          const users = await Promise.all(userIds.map((id) => getUser(id)));
          setUsernames(
            users.map((u) => u.userName || u.username || "Unknown User")
          );
        }
      } catch (error) {
        console.error("Failed to load completed room:", error);
      } finally {
        setLoading(false);
      }
    }

    loadRoom();
  }, [roomCode]);

  if (loading) {
    return (
      <div className="admin-container admin-dashboard">
        <div className="rooms-grid">
          <p className="rooms-section-subtitle">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="admin-container admin-dashboard">
        <div className="rooms-grid">
          <button className="btn-secondary-admin" onClick={() => navigate("/admin", {state: { showCompletedRooms: true}})}>
            Back
          </button>
          <p className="rooms-section-subtitle">Room not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container admin-dashboard">
      <div className="rooms-grid">
        <div className="admin-top">
          <button
            className="btn-secondary-admin"
            onClick={() => navigate("/admin", {state: { showCompletedRooms: true}})}
          >
            Back to Completed Rooms
          </button>
        </div>

        <h2 className="rooms-section-title">Completed Room {room.roomCode}</h2>
        <p className="rooms-section-subtitle">Full room data</p>

        <div className="room-display">
          <span className="room-code-badge">{room.roomCode}</span>

          <div className="room-meta">
            <span className="meta-item">Game: {room.gameType}</span>
            <span className="meta-item">Model: {room.modelType}</span>
            <span className="meta-item">Status: {room.status}</span>
            <span className="meta-item users">
              Users: {usernames.length > 0 ? usernames.join(", ") : "No users"}
            </span>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <h3>Raw Room Data</h3>
            <pre
              style={{
                background: "#0f172a",
                color: "#e2e8f0",
                padding: "1rem",
                borderRadius: "12px",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(room, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompletedRoomPage;