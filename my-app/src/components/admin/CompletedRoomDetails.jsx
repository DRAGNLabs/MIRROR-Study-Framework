import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom } from "../../services/roomsService";
import { getUser } from "../../services/usersService";
import { getUsersSurvey } from "../../services/surveyService";
import { buildConversation } from "../survey/surveyUtils";
import games from "../../gameLoader";
import MessageMarkdown from "../interaction/MessageMarkdown.jsx";
import "../interaction/interaction.css";
import "./admin.css";

function annotationsByMessageIndex(users, userSurveys) {
  const map = {};
  for (const user of users) {
    const userKey = user.userId ?? user.id;
    const survey = userSurveys[userKey];
    const marks = survey?.data?.conversationMarks ?? [];
    const commenter = user.userName || user.username || `User ${userKey}`;
    for (const mark of marks) {
      const idx = mark?.messageIndex;
      if (typeof idx !== "number" || idx < 0) continue;
      if (!map[idx]) map[idx] = [];
      map[idx].push({
        commenter,
        note: typeof mark.note === "string" ? mark.note : "",
      });
    }
  }
  return map;
}

function conversationMessageSafeText(msg) {
  const rawText = typeof msg?.text === "string" ? msg.text : "";
  const isJsonLike =
    rawText.trim().startsWith("{") &&
    rawText.includes("allocationByUserName");
  return isJsonLike
    ? "An internal allocation update occurred."
    : rawText;
}

function conversationMessageSenderLabel(msg) {
  if (!msg) return "Unknown";
  return msg.sender === "user" ? msg.userName || "You" : "LLM";
}

function normalizeConversationMessageIndex(messageIndex) {
  const n = Number(messageIndex);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export function CompletedRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [userSurveys, setUserSurveys] = useState({});
  const [users, setUsers] = useState([]);
  const [room, setRoom] = useState(null);
  const [usernames, setUsernames] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoom() {
      try {
        const roomData = await getRoom(roomCode);
        setRoom(roomData);

        const userIds = roomData?.userIds ?? [];

        if (userIds.length > 0) {
          const users = await Promise.all(userIds.map((id) => getUser(id)));
          setUsers(users);
          setUsernames(
            users.map((u) => u.userName || u.username || "Unknown User")
          );

          const surveys = await Promise.all(
            userIds.map(async (id) => {
              try {
                const survey = await getUsersSurvey(id);
                return [id, survey];
              } catch {
                return [id, null];
              }
            })
          );
          setUserSurveys(Object.fromEntries(surveys));
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

  const messageAnnotations = useMemo(
    () => annotationsByMessageIndex(users, userSurveys),
    [users, userSurveys]
  );

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

  const selectedSurvey = games.find(
    (g) => parseInt(g.id) === room.gameType
  );

  const surveyQuestions = (selectedSurvey?.questions || []).filter(
    (q) => q.type !== "label"
  );

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

              const annotations = messageAnnotations[i] ?? [];

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
                  <span><MessageMarkdown content={safeText} /></span>
                  {annotations.length > 0 && (
                    <div
                      className="message-survey-annotations"
                      aria-label="Survey annotations for this message"
                    >
                      {annotations.map((a, j) => (
                        <div
                          key={`${i}-annotation-${j}`}
                          className="message-survey-annotation"
                        >
                          <span className="message-survey-annotation-author">
                            {a.commenter}
                          </span>
                          <span className="message-survey-annotation-note">
                            {a.note?.trim()
                              ? a.note
                              : "No note provided"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>


      <div className="room-display" style={{ marginTop: "1.5rem" }}>
  <h2 className="room-section-title">Survey Information</h2>

  {surveyQuestions.length === 0 ? (
    <p className="survey-empty">No survey questions found.</p>
  ) : (
    <div className="survey-list">
      {surveyQuestions.map((question) => (
        <div key={question.id} className="survey-field">
          <div className="survey-question">{question.label}</div>

          <div className="survey-user-answers">
            {users.map((user) => {
              const userKey = user.userId ?? user.id;
              const survey = userSurveys[userKey];
              const answers = survey?.data?.answers || {};
              const answer = answers[question.id];
              const displayName =
                user.userName || user.username || `User ${userKey}`;

              return (
                <div
                  key={`${question.id}-${userKey}`}
                  className="survey-user-answer-row"
                >
                  <span className="survey-user-name">{displayName}:</span>
                    {answer == null || answer === "" ? (
                      <span className="survey-answer"> No response</span>
                    ) : Array.isArray(answer) ? (
                      <ol className="survey-answer-list">
                        {answer.map((item, index) => (
                          <li key={`${question.id}-${userKey}-${index}`}>
                            {item}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <span className="survey-answer">{String(answer)}</span>
                    )}
                  </div>
          
              );
            })}
          </div>
        </div>
      ))}
    </div>
  )}

  <div className="survey-section" style={{ marginTop: "1.5rem" }}>
    <h4 className="survey-section-title">Marked Conversation Moments</h4>

    {users.map((user) => {
      const userKey = user.userId ?? user.id;
      const survey = userSurveys[userKey];
      const conversationMarks = survey?.data?.conversationMarks || [];
      const displayName =
        user.userName || user.username || `User ${userKey}`;

      return (
        <div key={`marks-${userKey}`} className="survey-field">
          <div className="survey-question">{displayName}</div>

          {conversationMarks.length === 0 ? (
            <div className="survey-answer">No conversation moments were marked.</div>
          ) : (
            <div className="survey-admin-fields">
              {conversationMarks.map((mark, index) => (
                <div key={`mark-${userKey}-${index}`} className="survey-user-answer-row">
                  <span className="survey-user-name">
                    Message {mark.messageIndex}:
                  </span>
                  <div className="survey-answer">
                    {mark.note || "No note provided"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
    </div>
  </div>
  );
}

export default CompletedRoomPage;
