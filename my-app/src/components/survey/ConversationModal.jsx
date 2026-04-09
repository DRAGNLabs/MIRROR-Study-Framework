import { useEffect, useRef } from "react";
import MessageMarkdown from "../interaction/MessageMarkdown.jsx";
import "../interaction/interaction.css";
import "./survey.css";
export default function ConversationModal({ open, onClose, messages }) {
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>Conversation History</h2>

        <div className="chat-box" ref={chatBoxRef}>
          {messages.map((msg, i) => {
            const safeText = typeof msg.text === "string" ? msg.text : "";
            return (
              <div
                key={msg.id ?? i}
                className={`message ${msg.sender === "user" ? "message--user" : "message--bot"}`}
              >
                <span className="message-sender">
                  {msg.sender === "user" ? (msg?.userName || "You") : "LLM"}
                </span>
                <MessageMarkdown content={safeText} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}