import { useEffect, useRef } from "react";
import MessageMarkdown from "../interaction/MessageMarkdown.jsx";
import "../interaction/interaction.css";
import "./survey.css";
import { createPortal } from "react-dom";

export default function ConversationModal({ open, onClose, messages }) {
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="conversation-modal-card"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="modal-header">
          <h2>Conversation History</h2>
          <button className="modal-close" onClick={onClose}>✕</button> 
        </div>

        <div className="conversation-modal-chat-box" ref={chatBoxRef}>
          {messages.map((msg, i) => (
            <div
              key={msg.id ?? i}
              className={`message ${msg.sender === "user" ? "message--user" : "message--bot"}`}
            >
              <span className="message-sender">
                {msg.sender === "user" ? (msg?.userName || "You") : "LLM"}
              </span>
              <span>
                <MessageMarkdown content={safeText} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
