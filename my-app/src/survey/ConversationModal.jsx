import { useEffect, useRef } from "react";
import MarkdownMessage from "../components/MarkdownMessage.jsx";
export default function ConversationModal({ open, onClose, messages }) {
  if (!open) return null;
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>Conversation History</h2>

        <div className="chat-box" ref={chatBoxRef}>
          {messages.map((msg, i) => (
            <div
              key={msg.id ?? i}
              className={`message ${msg.sender === "user" ? "message--user" : "message--bot"}`}
            >
              <span className="message-sender">
                {msg.sender === "user" ? (msg?.userName || "You") : "LLM"}
              </span>
              <MarkdownMessage text={msg.text} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}