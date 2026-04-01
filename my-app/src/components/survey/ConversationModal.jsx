import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import './survey.css'

export default function ConversationModal({ open, onClose, messages }) {
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (!open || !chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages, open]);

  if (!open) return null;

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

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
              <span className="message-text">
                {msg.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
