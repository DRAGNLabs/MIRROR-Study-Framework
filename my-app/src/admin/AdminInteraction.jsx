/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket.js';
import { getRoom, updateStatus } from '../../services/roomsService.js'
import { getUser } from '../../services/usersService.js'
import FishPerRoundChart from '../components/FishPerRoundChart.jsx'

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


    const startClientTimer = (endTime) => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        const updateTimer = () => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                clearInterval(timerIntervalRef.current);
            }
        };

        updateTimer();
        timerIntervalRef.current = setInterval(updateTimer, 1000);
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleConnect = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", { roomCode, isAdmin}); 
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }

        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]);
        });
        

        socket.on("all-user-messages", ({ round, messages }) => {
            loadCurrUserMessages.current = true;
            setMessages((prev) => [...prev, ...messages]);
        });

        socket.on("ai-start", () => {
            isStreamingRef.current = true;
            const newId = Date.now();
            setCurrentStreamingId(newId);
            setStreamingText("");
            setMessages((prev) => [
                ...prev,
                {sender: "llm", text: "", id: newId},
            ]);
        });

        socket.on("ai-token", (token) => {
            setStreamingText(prev => prev + token);
        });

        socket.on("ai-end", async () => {
            isStreamingRef.current = false;
            setCurrentStreamingId(null);
            setStreamingText("");
        });

        socket.on("force-return-to-login", () => {
            navigate("/admin");
        });

        socket.on("round-complete", (round) => {
            setTimeRemaining(null); 
            loadCurrUserMessages.current = false;
            if (timerIntervalRef.current) { 
                clearInterval(timerIntervalRef.current);
            }
            loadRoomState();
        });

        socket.on("timer-start", ({ duration, endTime }) => {
            console.log(`Timer started: ${duration}ms`);
            startClientTimer(endTime);
        });

        socket.on("timer-expired", () => {
            console.log("Timer expired");
            setTimeRemaining(null);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        });


        return () => {
            socket.off("connect", handleConnect);
            socket.off("receive-message");
            socket.off("all-user-messages");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("round-complete");
            socket.off("force-return-to-login");
            socket.off("timer-start");
            socket.off("timer-expired");
    
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [socket]);

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
        // socket.emit("start-survey", { roomCode });
        await updateStatus(roomCode, "survey");
        navigate("/admin/survey", { state: { roomCode } });
    }

    async function getUserName(userId) {
        try {
            const user = await getUser(userId);
            return user.userName;
        } catch (error) {
            console.error("Error:", error);
            // setError(error.message || "something went wrong.");
        }
    }

    async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds, fish_amount) {
        const newMsgs = [];

        const rounds = Object.keys(llmInstructions).sort((a,b) => a-b);
        for (const round of rounds) {
            if (llmInstructions[round]) {
                newMsgs.push({ sender: "llm", text: llmInstructions[round], id: `llm-instructions-${round}`});
            }
            const msgs = userMessages[round] || [];
            for (const [userId, text] of msgs) {
                const userName = await getUserName(userId);
                if (llmResponse[round] || loadCurrUserMessages.current) {
                    newMsgs.push({ sender: "user", userId, userName: userName, text});
                }
            }
            if (llmResponse[round]) {
                newMsgs.push({ sender: "llm", text: llmResponse[round], id: `llm-${round}`});
            }
            if (parseInt(round) === parseInt(numRounds) && llmResponse[round]) { // this check needs to change
                newMsgs.push({ sender: "user", userName: "Admin", text: "All rounds are complete, game is ended."});
            }
            if(fish_amount[parseInt(round)+1] < 5) {
                newMsgs.push({ sender: "user", userName: "Admin", text: "Fish got below 5 tons, no more fish left to allocate game is over", id: "no-fish-left" });
            }
            
        }
        return newMsgs;
    }

    async function refreshResourceAllocations() {
        try {
            const room = await getRoom(roomCode);
            if (room.resourceAllocations) {
                const parsed = room.resourceAllocations ?? {};
                const history = Object.keys(parsed)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((roundKey) => {
                        const roundNumber = Number(roundKey);
                        const entry = parsed[roundKey] || {};
                        const allocationByUserName = entry.allocationByUserName || {};
                        return { round: roundNumber, allocations: allocationByUserName };
                    });
                setResourceHistory(history);
            }
        } catch (err) {
            console.error("Failed to refresh resource allocations:", err);
        }
    }

    // Load full room state: chat history + resource allocations
    async function loadRoomState() {
        try {
            const room = await getRoom(roomCode);
            const llmInstructions = room.llmInstructions ?? {};
            const userMessages = room.userMessages ?? {};
            const llmResponse = room.llmResponse ?? {};
            const numRounds = room.numRounds ?? 1;
            const fish_amount = room.fish_amount ?? {};

            const newMsgs = await resetMessages(llmInstructions, userMessages, llmResponse, numRounds, fish_amount);

            // Parse resourceAllocations if present
            if (room.resourceAllocations) {
                try {
                    const parsed = room.resourceAllocations ?? {};

                    const history = Object.keys(parsed)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((roundKey) => {
                            const roundNumber = Number(roundKey);
                            const entry = parsed[roundKey] || {};
                            const allocationByUserName = entry.allocationByUserName || {};
                            return {
                                round: roundNumber,
                                allocations: allocationByUserName
                            };
                        });

                    setResourceHistory(history);
                } catch (err) {
                    console.error("Error parsing resourceAllocations (admin):", err);
                    setResourceHistory([]);
                }
            } else {
                setResourceHistory([]);
            }

            if (isStreamingRef.current) {
                return;
            }
            setMessages(newMsgs);
        } catch (error) {
            console.error("Error loading admin room state:", error);
        }
    }


    useEffect(() => {
        loadRoomState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomCode]);

    return (
        <>
        <div className="admin-interaction-page">
            <header className="admin-interaction-header">
                <h1 className="admin-interaction-header-title">Admin</h1>
                <span className="admin-interaction-room-badge">Room {roomCode}</span>
                {/* {timeRemaining !== null && (
                    <span className="admin-timer-badge">⏱ {formatTime(timeRemaining)}</span>
                )} */}
                <span className="admin-interaction-header-spacer" aria-hidden="true" />
            </header>

            <div className="admin-interaction-main-layout">
                <div className="admin-interaction-chat-container">
                    <div className="admin-interaction-chat-box" ref={chatBoxRef}>
                        {messages.length === 0 && (
                            <div className="chat-placeholder">
                                <p>Conversation will appear here as participants and the LLM respond.</p>
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
                                        {msg.sender === "user" ? (msg?.userName || "Participant") : "LLM"}
                                    </span>
                                    <span className="message-text">{safeText}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <aside className="admin-resources-panel" aria-label="Fish resource split (admin)">
                    {timeRemaining !== null && (
                        <span className="admin-timer-badge">⏱ {formatTime(timeRemaining)}</span>
                    )}
                    <div className="resources-header">
                        <div>
                            <h2 className="resources-title">Resource Split (Fish)</h2>
                            <p className="resources-subtitle">Per-user allocations by round</p>
                        </div>
                    </div>

                    {/* ── Total allocations (prominent) ── */}
                    {resourceHistory.length > 0 ? (() => {
                        const totals = {};
                        resourceHistory.forEach(({ allocations }) => {
                            Object.entries(allocations).forEach(([userId, details]) => {
                                totals[userId] = (totals[userId] ?? 0) + (details?.fish ?? 0);
                            });
                        });

                        return (
                            <>
                                <div className="resources-section-label">Total (all rounds)</div>
                                <ul className="resources-list">
                                    {Object.entries(totals).map(([userId, total]) => (
                                        <li key={userId} className="resources-row">
                                            <div className="resources-row-main">
                                                <span className="resources-row-name">User {userId}</span>
                                            </div>
                                            <span className="resources-row-fish">{total} fish</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        );
                    })() : (
                        <div className="resources-empty">
                            <p>Fish allocations will appear here after the first round.</p>
                        </div>
                    )}

                    {/* ── Per-round history (smaller) ── */}
                    {resourceHistory.length > 0 && (
                        <div className="resources-history">
                            <div className="resources-section-label">Round breakdown</div>
                            <ul className="resources-history-list">
                                {resourceHistory.map((entry) => (
                                    <li key={entry.round} className="resources-history-item">
                                        <span className="resources-history-round">
                                            Round {entry.round}
                                        </span>
                                        <span className="resources-history-summary">
                                            {Object.entries(entry.allocations)
                                                .map(([userId, details]) => {
                                                    const fishCount = details?.fish ?? 0;
                                                    return `${userId}: ${fishCount}`;
                                                })
                                                .join(", ")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <FishPerRoundChart resourceHistory={resourceHistory} playerKey="userId" dark={true} />
                        </div>
                    )}
                </aside>
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
     </>
    )

};