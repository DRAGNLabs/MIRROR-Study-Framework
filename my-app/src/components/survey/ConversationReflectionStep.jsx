/** Reflection step: user marks at least 3 of the Lake Manager's messages, labels each
 *  one Positive or Negative, and adds a note. Fishers' messages and the round
 *  instructions are shown for context but can't be marked.
 *  Each mark is saved as { messageIndex, feeling: "positive" | "negative", note }. */

import MarkdownMessage from "../interaction/MessageMarkdown.jsx";
import { isMarkableMessage, requiredMarkCount } from "./surveyUtils";

const PROMPT =
  "Review the conversation below. Mark at least three of the Lake Manager's allocation memos that made you feel good (positive) or bad (negative). For each, choose Positive or Negative from the dropdown and briefly explain what about the message caused that feeling.";

function getMarkRank(marks, messageIndex) {
  const idx = marks.findIndex((m) => m.messageIndex === messageIndex);
  return idx === -1 ? null : idx + 1;
}

export default function ConversationReflectionStep({ messages, marks, onMarksChange }) {
  function toggleMark(messageIndex) {
    if (getMarkRank(marks, messageIndex) !== null) {
      onMarksChange(marks.filter((m) => m.messageIndex !== messageIndex));
      return;
    }
    onMarksChange([...marks, { messageIndex, feeling: "", note: "" }]);
  }

  function updateMark(messageIndex, changes) {
    onMarksChange(
      marks.map((m) => (m.messageIndex === messageIndex ? { ...m, ...changes } : m))
    );
  }

  const required = requiredMarkCount(messages);

  return (
    <div className="conversation-reflection">
      <p className="reflection-prompt">{PROMPT}</p>
      <p className="reflection-summary">
        You've marked {marks.length} message{marks.length === 1 ? "" : "s"} (at least {required} required)
      </p>
      <div className="reflection-chat">
        {messages.map((msg, i) => {
          const isUser = msg.sender === "user";
          const text = typeof msg.text === "string" ? msg.text : "";
          // sender label styled like the interaction page's chat (ChatMessages.jsx)
          const sender = (
            <span className="reflection-message-sender">
              {isUser ? (msg?.userName || "You") : "Lake Manager"}
            </span>
          );

          // Fishers' messages and round instructions are context only
          if (!isMarkableMessage(msg)) {
            return (
              <div key={i} className="reflection-message-wrapper">
                <div className={`reflection-message ${isUser ? "message--user" : "message--bot"} reflection-message--static`}>
                  {sender}
                  <MarkdownMessage content={text} />
                </div>
              </div>
            );
          }

          const rank = getMarkRank(marks, i);
          const mark = rank !== null ? marks[rank - 1] : null;
          const feelingClass = mark?.feeling ? `reflection-message--${mark.feeling}` : "";
          return (
            <div key={i} className="reflection-message-wrapper">
              <button
                type="button"
                className={`reflection-message message--bot ${mark ? "reflection-message--marked" : ""} ${feelingClass}`}
                onClick={() => toggleMark(i)}
                title={mark ? "Click to unmark" : "Click to mark this message"}
              >
                {mark && (
                  <span className="reflection-message-badge" aria-hidden>
                    {rank}
                  </span>
                )}
                {sender}
                <MarkdownMessage content={text} />
              </button>
              {mark && (
                <div className="reflection-note-wrap">
                  <select
                    className={`reflection-feeling-select ${mark.feeling ? `reflection-feeling-select--${mark.feeling}` : ""}`}
                    value={mark.feeling ?? ""}
                    onChange={(e) => updateMark(i, { feeling: e.target.value })}
                    aria-label={`Feeling for marked message ${rank}`}
                  >
                    <option value="">How did this message make you feel?</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                  </select>
                  <input
                    type="text"
                    className="reflection-note-input"
                    placeholder="What about this message caused that feeling?"
                    value={mark.note ?? ""}
                    onChange={(e) => updateMark(i, { note: e.target.value })}
                    aria-label={`Note for marked message ${rank}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
