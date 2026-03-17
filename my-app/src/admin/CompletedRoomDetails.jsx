import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom } from "../../services/roomsService";
import { getUser } from "../../services/usersService";
import { buildConversation } from "../survey/BuildRoom";
import games from "../gameLoader";

export function CompletedRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [usernames, setUsernames] = useState([]);
  const [survey, setSurvey] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoom() {
      try {
        const roomData = await getRoom(roomCode);
        setRoom(roomData);

        const selectedSurvey = games.find(g => parseInt(g.id) === roomData.gameType);
        setSurvey(selectedSurvey);

        const userIds = roomData?.userIds ?? [];
        if (userIds.length > 0) {
          const users = await Promise.all(userIds.map((id) => getUser(id)));
          setUsernames(
            users.map((u) => u.userName || u.username || "Unknown User")
          );
        }

        const msgs = await buildConversation(roomData);
        setConversation(msgs);
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
          <button
            className="btn-secondary-admin"
            onClick={() =>
              navigate("/admin", { state: { showCompletedRooms: true } })
            }
          >
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
        <button
          className="btn-secondary-admin"
          style={{ marginBottom: "1rem"}}
          onClick={() =>
            navigate("/admin", { state: { showCompletedRooms: true } })
          }
        >
          Back
        </button>

        <div className="room-display">
          <h2 className="room-section-title">
            Completed Room {room.roomCode}
          </h2>
          <p className="room-section-subtitle">
            Conversation transcript and room details
          </p>
        <div className="room-badges">
          <span className="room-badge">Room Code: {room.roomCode}</span>
          <span className="room-badge">Game: {room.gameType || "Unknown"}</span>
          <span className="room-badge">Model: {room.modelType || "Unknown"}</span>
          <span className="room-badge">Rounds: {room.numRounds}</span>
          <span className="room-badge">People: {room.usersNeeded}</span>
          <span className="room-badge room-badge-users">
            Users: {usernames.length > 0 ? usernames.join(", ") : "No users"}
          </span>
        </div>
        </div>

        <div className="chat-container">
        <div className="chat-box">
          {conversation.length === 0 ? (
            <div className="chat-placeholder">
              <p>No conversation found for this room.</p>
            </div>
          ) : (
            conversation.map((msg, i) => {
              const rawText = typeof msg.text === "string" ? msg.text : "";
              const isJsonLike =
                rawText.trim().startsWith("{") &&
                rawText.includes("allocationByUserName");

              const safeText = isJsonLike
                ? "An internal allocation update occurred."
                : rawText;

              return (
                <div
                  key={msg.id ?? i}
                  className={`message ${
                    msg.sender === "user" ? "message--user" : "message--bot"
                  }`}
                >
                  <span className="message-sender">
                    {msg.sender === "user" ? msg?.userName || "You" : "LLM"}
                  </span>
                  <span className="message-text">{safeText}</span>
                </div>
              );
            })
          )}
        </div>
        </div>


      <div className="room-display" style={{ marginTop: "1.5rem" }}>
        <h2 className="room-section-title">Survey Information</h2>

        <div className="room-badges" style={{ marginBottom: "1rem" }}>
          <span className="room-badge">
            Submitted: {room?.surveyData ? "Yes" : "No"}
          </span>
        </div>

        {!room?.surveyData ? (
          <p className="rooms-section-subtitle">No survey data found for this room.</p>
        ) : (
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
            {JSON.stringify(room.surveyData, null, 2)}
          </pre>
        )}
      </div>
      </div>
    </div>
  );
}

export default CompletedRoomPage;