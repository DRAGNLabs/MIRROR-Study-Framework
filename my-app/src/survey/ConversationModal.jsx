import { useState, useEffect, useRef } from "react";
export default function ConversationModal({ open, onClose, messages }) {
  if (!open) return null;
  const chatBoxRef = useRef(null);

  useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current = 0;
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
                        key={i}
                        className={`message ${msg.sender === "user" ? "user" : "bot"}`}
                    >
                    {msg.sender === "user"
                        ? `${msg?.userName || "You"}: ${msg.text}`
                        : `LLM: ${msg.text}`}
                    </div>
                ))}
            </div> 
      </div>
    </div>
  );
}