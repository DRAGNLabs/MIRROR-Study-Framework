/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../../socket.js';
import { formatTime } from "./interactionUtils.js";
import { updateStatus } from '../../../services/roomsService.js'
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

    return (
        <div className="admin-interaction-page">
            <header className="admin-interaction-header">
                <h1 className="admin-interaction-header-title">Admin</h1>
                <span className="admin-interaction-room-badge">Room {roomCode}</span>
                <span className="admin-interaction-header-spacer" aria-hidden="true" />
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