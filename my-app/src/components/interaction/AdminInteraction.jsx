/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../../socket.js';
import { formatTime } from "./interactionUtils.js";
import { getRoom, updateStatus } from '../../services/roomsService.js'
import ChatBox from "./ChatMessages.jsx";
import ResourcesPanel from "./ResourcePanel.jsx";
import './interaction.css'
import { useInteractionSocket } from "./interactionSocket.js";


export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = location.state;
    const isAdmin = true;
    const [sentMessages, setSentMessages] = useState(0);

    const [messages, setMessages] = useState([]); 
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [resourceHistory, setResourceHistory] = useState([]);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [showResources, setShowResources] = useState(false);
    const [practiceEnabled, setPracticeEnabled] = useState(false);
    const [practiceComplete, setPracticeComplete] = useState(false);
    const [officialStarted, setOfficialStarted] = useState(false);
    const [officialComplete, setOfficialComplete] = useState(false);
    const [startingOfficialGame, setStartingOfficialGame] = useState(false);

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
        setCurrentStreamingId,
        setSentMessages
    )

    useEffect(() => {
        socket.emit("practice-round", { roomCode });
    }, [roomCode]);

    useEffect(() => {
        let mounted = true;
        const loadGamePhase = async () => {
            try {
                const room = await getRoom(roomCode);
                if (!mounted) return;
                const practiceData = room.practiceData ?? {};
                setPracticeEnabled(!!room.practice);
                setPracticeComplete(practiceData.status === "complete");
                setOfficialStarted(!!practiceData.officialStarted);
                setOfficialComplete(!!practiceData.officialComplete);
                setStartingOfficialGame(false);
            } catch (error) {
                console.error("Failed to load game phase:", error);
            }
        };

        const handleOfficialStarted = () => {
            setStartingOfficialGame(false);
            setOfficialStarted(true);
        };
        const handlePracticeComplete = () => {
            setPracticeComplete(true);
            loadGamePhase();
        };
        const handleGameComplete = () => {
            setOfficialComplete(true);
            loadGamePhase();
        };
        const handleStartError = () => setStartingOfficialGame(false);

        loadGamePhase();
        socket.on("official-game-started", handleOfficialStarted);
        socket.on("practice-round-complete", handlePracticeComplete);
        socket.on("game-complete", handleGameComplete);
        socket.on("official-game-start-error", handleStartError);
        socket.on("connect", loadGamePhase);
        return () => {
            mounted = false;
            socket.off("official-game-started", handleOfficialStarted);
            socket.off("practice-round-complete", handlePracticeComplete);
            socket.off("game-complete", handleGameComplete);
            socket.off("official-game-start-error", handleStartError);
            socket.off("connect", loadGamePhase);
        };
    }, [roomCode]);

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

    async function nextFromInteraction() {
        if (practiceEnabled && !officialStarted) {
            if (!practiceComplete || startingOfficialGame) return;
            setStartingOfficialGame(true);
            socket.emit("start-official-game", { roomCode });
            return;
        }
        if (practiceEnabled && !officialComplete) return;

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
                <h1 className="admin-interaction-header-title">
                    {practiceEnabled ? (officialStarted ? "Game Room" : "Practice Room") : "Admin"}
                </h1>
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
                    sentMessages={sentMessages}
                />
            </div>

            <footer className="admin-interaction-footer">
                <button
                    type="button"
                    className="admin-interaction-next-btn"
                    onClick={nextFromInteraction}
                    disabled={practiceEnabled && (!practiceComplete || startingOfficialGame || (officialStarted && !officialComplete))}
                >
                    {practiceEnabled && !officialStarted
                        ? (practiceComplete ? "Next → Game" : "Practice in progress")
                        : practiceEnabled && !officialComplete
                            ? "Game in progress"
                            : "Next → Survey"}
                </button>
            </footer>
        </div>
    );
};
