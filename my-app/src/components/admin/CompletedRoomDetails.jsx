import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom } from "../../services/roomsService";
import { getUser } from "../../services/usersService";
import { getUsersSurvey } from "../../services/surveyService";
import { buildConversation, buildResourceHistory } from "../survey/surveyUtils";
import { buildStatusHistory } from "../interaction/interactionUtils";
import { buildTownReportForRound } from "./completedRoomUtils";
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

function displayNameFor(user) {
  const key = user.userId ?? user.id;
  return user.userName || user.username || `User ${key}`;
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
          setUsernames(users.map(displayNameFor));

          // Bots don't take a survey — skip fetching entirely for test rooms.
          if (!roomData.isTest) {
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

  const game = useMemo(
    () => (room ? games.find((g) => parseInt(g.id) === room.gameType) : null),
    [room]
  );

  const hasStatusFeature = !!game?.role_prompt;

  const resourceHistory = useMemo(
    () => (room ? buildResourceHistory(room) : []),
    [room]
  );

  const resourceTotals = useMemo(() => {
    const totals = {};
    for (const entry of resourceHistory) {
      for (const [name, details] of Object.entries(entry.allocations ?? {})) {
        totals[name] = (totals[name] ?? 0) + (details?.fish ?? 0);
      }
    }
    return totals;
  }, [resourceHistory]);

  const roundNumbers = useMemo(() => {
    if (!room?.numRounds) return [];
    return Array.from({ length: room.numRounds }, (_, i) => i + 1);
  }, [room]);

  // Per-user list of round-by-round status changes (same logic that drives
  // the live "My Status" popup/history on the interaction page).
  const statusTimelines = useMemo(() => {
    if (!hasStatusFeature || !room) return [];
    return users.map((user) => ({
      displayName: displayNameFor(user),
      history: buildStatusHistory(user, game, room.numRounds ?? room.curr_round ?? 1),
    }));
  }, [users, game, room, hasStatusFeature]);

  // Reconstructed per-round "town report" text sent to the LLM (never
  // persisted anywhere — see completedRoomUtils.js), stopping at whichever
  // round the game actually reached.
  const townReportsByRound = useMemo(() => {
    if (!hasStatusFeature || !room?.numRounds) return [];
    const reports = [];
    for (let round = 2; round <= room.numRounds; round++) {
      if (!room.llmInstructions?.[round]) break; // game ended before this round
      const text = buildTownReportForRound(users, game, round, room.resourceAllocations);
      if (text) reports.push({ round, text });
    }
    return reports;
  }, [users, game, room, hasStatusFeature]);

  if (loading) {
    return (
      <div className="admin-container admin-dashboard completed-room-page">
        <div className="rooms-grid">
          <p className="rooms-section-subtitle">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="admin-container admin-dashboard completed-room-page">
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

  const selectedSurvey = game;
  const surveyQuestions = (selectedSurvey?.questions || []).filter(
    (q) => q.type !== "label"
  );
  const showSurvey = !room.isTest;

  return (
    <div className="admin-container admin-dashboard completed-room-page">
      <div className="rooms-grid">
        <button
          className="btn-secondary-admin completed-room-back"
          onClick={() =>
            navigate("/admin", { state: { showCompletedRooms: true } })
          }
        >
          Back
        </button>

        <div className="room-display completed-room-summary">
          <h2 className="room-section-title">
            Completed Room {room.roomCode}
          </h2>
          <p className="room-section-subtitle">
            Conversation transcript and room details
          </p>
          <div className="room-badges">
            {room.isTest && (
              <span className="room-badge test-mode-badge">Automated Test</span>
            )}
            <span className="room-badge">Room Code: {room.roomCode}</span>
            <span className="room-badge">Game: {selectedSurvey?.title || room.gameType || "Unknown"}</span>
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

        <div className="completed-room-panel">
          <h3 className="completed-room-panel-title">Conversation Transcript</h3>
          <div className="completed-room-chat-scroll">
            {conversation.length === 0 ? (
              <div className="completed-room-chat-placeholder">
                <p>No conversation found for this room.</p>
              </div>
            ) : (
              <div className="completed-room-messages">
                {conversation.map((msg, i) => {
                  const annotations = messageAnnotations[i] ?? [];
                  return (
                    <div
                      key={msg.id ?? i}
                      className={`completed-room-message ${
                        msg.sender === "user" ? "completed-room-message--user" : "completed-room-message--bot"
                      }`}
                    >
                      <span className="completed-room-message-sender">
                        {conversationMessageSenderLabel(msg)}
                      </span>
                      <span className="completed-room-message-text">
                        <MessageMarkdown content={conversationMessageSafeText(msg)} />
                      </span>
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
                                {a.note?.trim() ? a.note : "No note provided"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showSurvey && (
          <div className="completed-room-panel completed-room-panel--full">
            <h3 className="completed-room-panel-title">Survey Information</h3>
            <div className="completed-room-survey-scroll">
              {surveyQuestions.length === 0 ? (
                <p className="survey-empty">No survey questions found.</p>
              ) : (
                <div className="completed-room-table-wrap">
                  <table className="completed-room-table">
                    <thead>
                      <tr>
                        <th>Question</th>
                        {usernames.map((name) => <th key={name}>{name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {surveyQuestions.map((question) => (
                        <tr key={question.id}>
                          <td className="completed-room-table-row-label">{question.label}</td>
                          {users.map((user) => {
                            const userKey = user.userId ?? user.id;
                            const survey = userSurveys[userKey];
                            const answers = survey?.data?.answers || {};
                            const answer = answers[question.id];
                            return (
                              <td key={`${question.id}-${userKey}`}>
                                {answer == null || answer === "" ? (
                                  <span className="survey-answer-empty">No response</span>
                                ) : Array.isArray(answer) ? (
                                  <ol className="survey-answer-list">
                                    {answer.map((item, index) => (
                                      <li key={`${question.id}-${userKey}-${index}`}>{item}</li>
                                    ))}
                                  </ol>
                                ) : (
                                  String(answer)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="survey-section">
                <h4 className="survey-section-title">Marked Conversation Moments</h4>
                {users.map((user) => {
                  const userKey = user.userId ?? user.id;
                  const survey = userSurveys[userKey];
                  const conversationMarks = survey?.data?.conversationMarks || [];
                  return (
                    <div key={`marks-${userKey}`} className="completed-room-mark-row">
                      <div className="survey-question">{displayNameFor(user)}</div>
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
        )}

        {resourceHistory.length > 0 && (
          <div className="room-display" style={{ marginTop: "1.5rem" }}>
            <h2 className="room-section-title">Resource Allocations</h2>
            <div className="completed-room-table-wrap completed-room-table-wrap--scroll">
              <table className="completed-room-table">
                <thead>
                  <tr>
                    <th>Round</th>
                    {usernames.map((name) => <th key={name}>{name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {resourceHistory.map((entry) => (
                    <tr key={entry.round}>
                      <td className="completed-room-table-row-label">Round {entry.round}</td>
                      {usernames.map((name) => (
                        <td key={name}>
                          {entry.allocations?.[name]?.fish ?? "—"} tons
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="completed-room-table-total-row">
                    <td className="completed-room-table-row-label">Total</td>
                    {usernames.map((name) => (
                      <td key={name}>{resourceTotals[name] ?? 0} tons</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {hasStatusFeature && (
          <div className="room-display" style={{ marginTop: "1.5rem" }}>
            <h2 className="room-section-title">Status Over Time</h2>
            <p className="room-section-subtitle">
              Each user's status by round, and — where it changed — the message they (and the LLM) received.
            </p>

            <div className="completed-room-table-wrap completed-room-table-wrap--scroll">
              <table className="completed-room-table completed-room-status-table">
                <thead>
                  <tr>
                    <th>User</th>
                    {roundNumbers.map((r) => <th key={r}>R{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {statusTimelines.map(({ displayName }, idx) => {
                    const user = users[idx];
                    const userStatus = user?.user_status ?? {};
                    return (
                      <tr key={displayName}>
                        <td className="completed-room-table-row-label">{displayName}</td>
                        {roundNumbers.map((r) => {
                          const raw = userStatus[r];
                          const value = raw ?? (r === 1 ? 0 : null);
                          const cellClass =
                            value == null ? "" : value > 0 ? "status-cell--good" : value < 0 ? "status-cell--bad" : "status-cell--neutral";
                          return (
                            <td key={r} className={cellClass}>
                              {value == null ? "—" : value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="completed-room-round-list">
              {townReportsByRound.map(({ round, text }) => {
                const messagesThisRound = statusTimelines
                  .map(({ displayName, history }) => ({
                    displayName,
                    entry: history.find((h) => h.round === round),
                  }))
                  .filter((x) => x.entry);

                return (
                  <div key={round} className="completed-room-round-card">
                    <h4 className="completed-room-round-title">Round {round}</h4>

                    <div className="completed-room-town-report">
                      <span className="completed-room-round-label">Town report sent to LLM</span>
                      <pre className="completed-room-town-report-text">{text}</pre>
                    </div>

                    {messagesThisRound.length > 0 && (
                      <div className="status-history-list">
                        {messagesThisRound.map(({ displayName, entry }) => (
                          <div
                            key={displayName}
                            className={`status-history-item ${entry.good ? "status-history-item--good" : "status-history-item--bad"}`}
                          >
                            <div className="status-history-item-header">
                              <span className="status-history-round">{displayName}</span>
                              <span className="status-history-badge">
                                {entry.good ? "Good news" : "Bad news"}
                              </span>
                            </div>
                            <p className="status-history-message">{entry.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompletedRoomPage;
