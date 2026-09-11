/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../../socket.js';
import { formatTime } from "./interactionUtils.js";
import { updateStatus } from '../../services/roomsService.js'
import ChatBox from "./ChatMessages.jsx";
import ResourcesPanel from "./ResourcePanel.jsx";
import './interaction.css'
import { useInteractionSocket } from "./interactionSocket.js";

export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = location.state;
    const isAdmin = true;

    const [messages, setMessages] = useState([]); 
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [resourceHistory, setResourceHistory] = useState([]);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [showResources, setShowResources] = useState(false);

    // const [error, setError] = useState("");
    const chatBoxRef = useRef(null);
    const isStreamingRef = useRef(false);
    const timerIntervalRef = useRef(null);
    const loadCurrUserMessages = useRef(false);

    useInteractionSocket(
        roomCode,
        isAdmin,
        null,
        isStreamingRef,
        timerIntervalRef,
        loadCurrUserMessages,
        setMessages,
        setResourceHistory,
        setTimeRemaining,
        setStreamingText,
        setCurrentStreamingId
    )

    useEffect(() => {
        if (!streamingText) return;

        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === currentStreamingId ? { ...msg, text: streamingText } : msg
            )
        );
    }, [streamingText]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    async function toSurvey() {
        socket.emit("navigate-users", { roomCode, status: "survey" });
        await updateStatus(roomCode, "survey");
        navigate("/admin/survey", { state: { roomCode } });
    }

    // adding these to fix formatting on mobile
    function handleLogout() {
        sessionStorage.removeItem("admin");
        navigate("/admin/login");
    }
 
    function handleHomeClick() {
        socket.emit("leave-room", { roomCode });
        sessionStorage.removeItem("roomCode");
        navigate("/admin");
    }

    return (
        <div className={`admin-interaction-page ${timeRemaining !== null ? 'has-timer' : ''}`}>
            {timeRemaining !== null && (
                <div className={`mobile-timer-bar ${timeRemaining <= 30 ? 'urgent' : ''}`}>
                    ⏱ Time remaining: {formatTime(timeRemaining)}
                </div>
            )}
            <header className="admin-interaction-header">
                <button
                    className='admin-resources-toggle-btn-header'
                    onClick={() => setShowResources(true)}
                >
                    Resources
                </button>
                <h1 className="admin-interaction-header-title">Admin</h1>
                <span className="admin-interaction-room-badge">Room {roomCode}</span>
                <div className="admin-header-mobile-nav">
                    <button onClick={handleHomeClick} className="admin-mobile-home-btn">Home</button>
                    <button onClick={handleLogout} className="admin-mobile-logout-btn">Logout</button>
                </div>
            </header>

            <div className="admin-interaction-main-layout">

                <div className="admin-interaction-chat-container">
                    <ChatBox
                        messages={messages}
                        chatBoxRef={chatBoxRef}
                        placeholder="Conversation will appear here as participants and the LLM respond."
                        isAdmin="Admin"
                    />
                </div>

                <ResourcesPanel
                    resourceHistory={resourceHistory}
                    timeRemaining={timeRemaining}
                    formatTime={formatTime}
                    isAdmin={true}
                    showResources={showResources}
                    onClose={() => setShowResources(false)}
                />
            </div>

            <footer className="admin-interaction-footer">
                <button
                    type="button"
                    className="admin-interaction-next-btn"
                    onClick={toSurvey}
                >
                    Next → Survey
                </button>
            </footer>
        </div>
    );
};