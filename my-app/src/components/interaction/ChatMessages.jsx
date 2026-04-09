import MessageMarkdown from "./MessageMarkdown.jsx";

export default function ChatBox({
    messages, 
    chatBoxRef,
    placeholder = "Messages will appear here once the round starts.",
    isAdmin = false
}) {    
    const containerClass = isAdmin ? "admin-interaction-chat-container" : "chat-container";
    const boxClass = isAdmin ? "admin-interaction-chat-box" : "chat-box";
    return (          
        <div className={containerClass}>
            <div className={boxClass} ref={chatBoxRef}>
                {messages.length === 0 && (
                    <div className="chat-placeholder">
                        <p>{placeholder}</p>
                    </div>
                )}
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
    );
}