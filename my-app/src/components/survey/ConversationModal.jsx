import { useEffect, useRef } from "react";
import './survey.css'
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
        className="conversation-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="modal-header">
        <h2>Conversation History</h2>
        <button className="modal-close" onClick={onClose}>✕</button> 
      </div>
        {/* <button className="modal-close" onClick={onClose}>✕</button> */}

        {/* <h2>Conversation History</h2> */}

        <div className="conversation-modal-chat-box" ref={chatBoxRef}>
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
}