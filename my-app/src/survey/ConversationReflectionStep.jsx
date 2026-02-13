/** Reflection step: user reviews conversation and marks up to 3 moments with optional notes. */

const MAX_MARKS = 3;
const PROMPT =
  "Review the conversation below. Mark up to three moments that stood out to you—for any reason. You can add a short note to each if you'd like.";

function getMarkRank(marks, messageIndex) {
  const idx = marks.findIndex((m) => m.messageIndex === messageIndex);
  return idx === -1 ? null : idx + 1;
}

function getMarkNote(marks, messageIndex) {
  const m = marks.find((m) => m.messageIndex === messageIndex);
  return m ? m.note ?? "" : "";
}

export default function ConversationReflectionStep({ messages, marks, onMarksChange }) {
  function toggleMark(messageIndex) {
    const rank = getMarkRank(marks, messageIndex);
    if (rank !== null) {
      onMarksChange(marks.filter((m) => m.messageIndex !== messageIndex));
      return;
    }
    if (marks.length >= MAX_MARKS) return;
    onMarksChange([...marks, { messageIndex, note: "" }]);
  }

  function setNote(messageIndex, note) {
    onMarksChange(
      marks.map((m) => (m.messageIndex === messageIndex ? { ...m, note } : m))
    );
  }

  const markCount = marks.length;

  return (
    <div className="conversation-reflection">
      <p className="reflection-prompt">{PROMPT}</p>
      <p className="reflection-summary">
        You've marked {markCount} of {MAX_MARKS} moments
      </p>
      <div className="reflection-chat">
        {messages.map((msg, i) => {
          const rank = getMarkRank(marks, i);
          const isMarked = rank !== null;
          const note = getMarkNote(marks, i);
          const label =
            msg.sender === "user"
              ? `${msg?.userName || "You"}: ${msg.text}`
              : `LLM: ${msg.text}`;
          return (
            <div key={i} className="reflection-message-wrapper">
              <button
                type="button"
                className={`reflection-message ${msg.sender === "user" ? "message--user" : "message--bot"} ${isMarked ? "reflection-message--marked" : ""}`}
                onClick={() => toggleMark(i)}
              >
                {isMarked && (
                  <span className="reflection-message-badge" aria-hidden>
                    {rank}
                  </span>
                )}
                <span className="reflection-message-text">{label}</span>
              </button>
              {isMarked && (
                <div className="reflection-note-wrap">
                  <input
                    type="text"
                    className="reflection-note-input"
                    placeholder="Add a note (optional)"
                    value={note}
                    onChange={(e) => setNote(i, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Note for marked moment ${rank}`}
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
