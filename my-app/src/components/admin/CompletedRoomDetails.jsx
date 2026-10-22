import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deidentifyCompletedRoom,
  exportCompletedRoom,
  getDeidentificationPreview,
  getRoom,
} from "../../services/roomsService";
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
  const [exportError, setExportError] = useState("");
  const [deidentificationPreview, setDeidentificationPreview] = useState(null);
  const [deidentificationModalOpen, setDeidentificationModalOpen] = useState(false);
  const [deidentificationLoading, setDeidentificationLoading] = useState(false);
  const [deidentificationSubmitting, setDeidentificationSubmitting] = useState(false);
  const [deidentificationPassword, setDeidentificationPassword] = useState("");
  const [deidentificationError, setDeidentificationError] = useState("");
  const [deidentificationMessage, setDeidentificationMessage] = useState("");

  async function exportRoom() {
    setExportError("");
    try {
      await exportCompletedRoom(roomCode);
    } catch (error) {
      setExportError(error.message || "Can't export room.");
    }
  }

  const loadRoomData = useCallback(async () => {
    setLoading(true);
    try {
      const roomData = await getRoom(roomCode);
      setRoom(roomData);

      const userIds = roomData?.userIds ?? [];
      if (userIds.length > 0) {
        const loadedUsers = await Promise.all(userIds.map((id) => getUser(id)));
        setUsers(loadedUsers);
        setUsernames(
          loadedUsers.map((user) => user.userName || user.username || "Unknown User")
        );

        const surveys = await Promise.all(
          userIds.map(async (id) => {
            try {
              return [id, await getUsersSurvey(id)];
            } catch {
              return [id, null];
            }
          })
        );
        setUserSurveys(Object.fromEntries(surveys));
      } else {
        setUsers([]);
        setUsernames([]);
        setUserSurveys({});
      }
      setConversation(await buildConversation(roomData));
    } catch (error) {
      console.error("Failed to load completed room:", error);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  useEffect(() => {
    if (!deidentificationModalOpen) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape" && !deidentificationSubmitting) {
        setDeidentificationModalOpen(false);
        setDeidentificationPassword("");
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [deidentificationModalOpen, deidentificationSubmitting]);

  async function openDeidentificationPreview() {
    setDeidentificationModalOpen(true);
    setDeidentificationLoading(true);
    setDeidentificationPreview(null);
    setDeidentificationError("");
    setDeidentificationPassword("");
    try {
      setDeidentificationPreview(await getDeidentificationPreview(roomCode));
    } catch (error) {
      setDeidentificationError(error.message || "Can't create preview.");
    } finally {
      setDeidentificationLoading(false);
    }
  }

  async function confirmDeidentification(event) {
    event.preventDefault();
    setDeidentificationError("");
    setDeidentificationSubmitting(true);
    try {
      const result = await deidentifyCompletedRoom(
        roomCode,
        deidentificationPassword,
        deidentificationPreview.confirmationToken
      );
      setDeidentificationModalOpen(false);
      setDeidentificationPassword("");
      setDeidentificationMessage(
        `${result.message} Replaced ${result.summary.participantNames} participant-name occurrences, ${result.summary.emails} email addresses, ${result.summary.phoneNumbers} phone numbers, and ${result.summary.locations} location patterns.`
      );
      await loadRoomData();
    } catch (error) {
      setDeidentificationError(error.message || "Can't deidentify completed room.");
    } finally {
      setDeidentificationSubmitting(false);
    }
  }

  function closeDeidentificationModal() {
    if (deidentificationSubmitting) return;
    setDeidentificationModalOpen(false);
    setDeidentificationPassword("");
  }

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
        <div className="room-actions" style={{ marginBottom: "1rem" }}>
          <button
            className="btn-secondary-admin"
            onClick={() =>
              navigate("/admin", { state: { showCompletedRooms: true } })
            }
          >
            Back
          </button>
          <button className="btn-secondary-admin" onClick={exportRoom}>
            Export
          </button>
          <button
            className="btn-secondary-admin"
            onClick={openDeidentificationPreview}
          >
            Deidentify room
          </button>
        </div>
        {exportError && <p role="alert">{exportError}</p>}
        {deidentificationMessage && (
          <p className="deidentify-success" role="status">
            {deidentificationMessage}
          </p>
        )}

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
          <span className="room-badge">
            People: {Array.isArray(room.userIds) ? room.userIds.length : usernames.length} (min {room.usersNeeded})
          </span>
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
    {deidentificationModalOpen && (
<div
  className="modal-backdrop"
  onMouseDown={(event) => {
    if (event.target === event.currentTarget) closeDeidentificationModal();
  }}
>
  <section
    className="confirm-modal-card deidentify-modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="deidentify-modal-title"
    aria-describedby="deidentify-modal-notice"
  >
    <button
      className="deidentify-modal-close"
      type="button"
      onClick={closeDeidentificationModal}
      disabled={deidentificationSubmitting}
      aria-label="Close preview"
    >
      &times;
    </button>
    <h2 className="confirm-modal-title" id="deidentify-modal-title">
      Review deidentification preview
    </h2>
    <p id="deidentify-modal-notice" className="deidentify-warning">
      This will permanently update the database for this completed room,
      its users, and surveys. No original-name mapping or automatic undo
      is kept. Participant IDs remain, so this is pseudonymization, not a
      guarantee of anonymity.
    </p>
    <p className="confirm-modal-text">
      The automatic scan targets participant names, email addresses,
      formatted phone numbers, and recognizable street-address/location
      patterns. It can miss other identifying details and may replace
      ordinary text that resembles these patterns. Review the preview
      before continuing.
    </p>

    {deidentificationLoading && <p role="status">Preparing preview...</p>}
    {deidentificationError && (
      <p className="deidentify-error" role="alert">
        {deidentificationError}
      </p>
    )}
    {deidentificationPreview && (
      <>
        <ul className="deidentify-summary">
          <li>Participants: {deidentificationPreview.summary.participants}</li>
          <li>Participant-name occurrences: {deidentificationPreview.summary.participantNames}</li>
          <li>Email addresses: {deidentificationPreview.summary.emails}</li>
          <li>Phone numbers: {deidentificationPreview.summary.phoneNumbers}</li>
          <li>Location patterns: {deidentificationPreview.summary.locations}</li>
        </ul>
        <details className="deidentify-preview-details">
          <summary>Review transformed room, users, and survey data</summary>
          <pre>{JSON.stringify({
            room: deidentificationPreview.room,
            users: deidentificationPreview.users,
            surveys: deidentificationPreview.surveys,
          }, null, 2)}</pre>
        </details>
        <form onSubmit={confirmDeidentification}>
          <label className="deidentify-password-label" htmlFor="deidentify-admin-password">
            Re-enter admin password to make this change
          </label>
          <input
            id="deidentify-admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={deidentificationPassword}
            onChange={(event) => setDeidentificationPassword(event.target.value)}
            disabled={deidentificationSubmitting}
          />
          <div className="confirm-modal-actions">
            <button
              className="btn-secondary-admin"
              type="button"
              onClick={closeDeidentificationModal}
              disabled={deidentificationSubmitting}
            >
              Cancel
            </button>
            <button
              className="deidentify-confirm-button"
              type="submit"
              disabled={
                deidentificationSubmitting ||
                !deidentificationPassword ||
                deidentificationLoading
              }
            >
              {deidentificationSubmitting
                ? "Updating database..."
                : "Looks good — permanently deidentify"}
            </button>
          </div>
        </form>
      </>
    )}
    {!deidentificationPreview && !deidentificationLoading && (
      <div className="confirm-modal-actions">
        <button
          className="btn-secondary-admin"
          type="button"
          onClick={closeDeidentificationModal}
        >
          Close
        </button>
        <button
          className="btn-secondary-admin"
          type="button"
          onClick={openDeidentificationPreview}
        >
          Retry preview
        </button>
      </div>
    )}
  </section>
</div>
    )}
  </div>
  );
}

export default CompletedRoomPage;
