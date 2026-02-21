/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket.js';
import { getRoom, updateStatus } from '../../services/roomsService.js'
import { getUser } from '../../services/usersService.js'

export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const { roomCode } = location.state;
    const isAdmin = true;

    const [messages, setMessages] = useState([]); 
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [resourceHistory, setResourceHistory] = useState([]);

    // const [error, setError] = useState("");
    const chatBoxRef = useRef(null);
    const isStreamingRef = useRef(false);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const currentRoundAllocations =
        resourceHistory.length > 0
            ? resourceHistory[resourceHistory.length - 1]
            : null;


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

        socket.on("ai-end", () => {
            isStreamingRef.current = false;
            setCurrentStreamingId(null);
            setStreamingText("");
        });


        socket.on("round-complete", (nextRound) => {
            socket.emit('start-round', {
                roomCode,
                round: nextRound
            });
            // Refresh room state so latest allocations and messages are visible.
            loadRoomState();
        });

        socket.on("force-return-to-login", () => {
            navigate("/admin");
        });


        return () => {
            socket.off("connect", handleConnect);
            socket.off("receive-message");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("round-complete");
            socket.off("force-return-to-login");
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
        socket.emit("start-survey", { roomCode });
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

    async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds) {
        const newMsgs = [];

        const rounds = Object.keys(llmInstructions).sort((a,b) => a-b);
        for (const round of rounds) {
            if (llmInstructions[round]) {
                newMsgs.push({
                    sender: "llm",
                    text: llmInstructions[round],
                    id: `llm-instructions-${round}`
                });
            }
            const msgs = userMessages[round] || [];
            for (const [userId, text] of msgs) {
                const userName = await getUserName(userId);
                newMsgs.push({
                    sender: "user",
                    userId,
                    userName: userName,
                    text
                });
            }
            if (llmResponse[round]) {
                newMsgs.push({
                    sender: "llm",
                    text: llmResponse[round],
                    id: `llm-${round}`
                });
            }
            if (parseInt(round) === parseInt(numRounds) && llmResponse[round]) { // this check needs to change
                newMsgs.push({
                    sender: "user",
                    userName: "Admin",
                    text: "All rounds are complete, game is ended."
                });
            }
            
        }
        return newMsgs;
    }

    // Load full room state: chat history + resource allocations
    async function loadRoomState() {
        try {
            const room = await getRoom(roomCode);
            const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
            const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};
            const llmResponse = room.llmResponse ? JSON.parse(room.llmResponse) : {};
            const numRounds = room.numRounds != null
                ? (typeof room.numRounds === "number" ? room.numRounds : JSON.parse(room.numRounds))
                : 1;

            const newMsgs = await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);

            // Parse resourceAllocations if present
            if (room.resourceAllocations) {
                try {
                    const parsed = typeof room.resourceAllocations === "string"
                        ? JSON.parse(room.resourceAllocations)
                        : room.resourceAllocations;

                    const history = Object.keys(parsed)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((roundKey) => {
                            const roundNumber = Number(roundKey);
                            const entry = parsed[roundKey] || {};
                            const allocationByUserId = entry.allocationByUserId || {};
                            return {
                                round: roundNumber,
                                allocations: allocationByUserId
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
        async function initialLoad() {
            try {
                await delay(1000); // wait for initial LLM instructions to land
                await loadRoomState();
            } catch (error) {
                console.error("Error loading admin conversation history:", error);
            // old code testing some stuff
            //     await delay(1000); // this makes sure the messages don't get reset before llmInstructions have sent
            //     const room = await getRoom(roomCode);
            //     const llmInstructions = room.llmInstructions;
            //     const userMessages = room.userMessages;
            //     const llmResponse = room.llmResponse;
            //     const numRounds = room.numRounds;
            //     const newMsgs =  await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);
            //     if (isStreamingRef.current) {
            //         console.log("Skipping database fetch during stream");
            //         return;
            //     }
            //     setMessages(newMsgs);
            // } catch (error){
            //     console.error("Error:", error);
            //     // setError(error.message || "Something went wrong.");
            }
        }

        initialLoad();
    }, [roomCode]);

    return (
        <>
        <div className="admin-interaction-page">
            <header className="admin-interaction-header">
                <h1 className="admin-interaction-header-title">Admin</h1>
                <span className="admin-interaction-room-badge">Room {roomCode}</span>
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
                            const rawText = typeof msg.text === "string" ? msg.text : "";
                            const isJsonLike =
                                rawText.trim().startsWith("{") &&
                                rawText.includes("allocationByUserId");
                            const safeText = isJsonLike
                                ? "An internal allocation update occurred."
                                : rawText;
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
                    <div className="resources-header">
                        <div>
                            <h2 className="resources-title">Resource Split (Fish)</h2>
                            <p className="resources-subtitle">Per-user allocations by round</p>
                        </div>
                        {currentRoundAllocations && (
                            <span className="resources-round-pill">
                                Round {currentRoundAllocations.round}
                            </span>
                        )}
                    </div>

                    {currentRoundAllocations ? (
                        <>
                            <div className="resources-section-label">Current round</div>
                            <ul className="resources-list">
                                {Object.entries(currentRoundAllocations.allocations).map(
                                    ([allocationUserId, details]) => {
                                        const fishCount = details?.fish ?? 0;
                                        return (
                                            <li
                                                key={allocationUserId}
                                                className="resources-row"
                                            >
                                                <div className="resources-row-main">
                                                    <span className="resources-row-name">
                                                        User {allocationUserId}
                                                    </span>
                                                </div>
                                                <span className="resources-row-fish">
                                                    {fishCount} fish
                                                </span>
                                            </li>
                                        );
                                    }
                                )}
                            </ul>
                        </>
                    ) : (
                        <div className="resources-empty">
                            <p>Fish allocations will appear here after the first round.</p>
                        </div>
                    )}

                    {resourceHistory.length > 1 && (
                        <div className="resources-history">
                            <div className="resources-section-label">Previous rounds</div>
                            <ul className="resources-history-list">
                                {resourceHistory
                                    .slice(0, -1)
                                    .map((entry) => (
                                        <li
                                            key={entry.round}
                                            className="resources-history-item"
                                        >
                                            <span className="resources-history-round">
                                                Round {entry.round}
                                            </span>
                                            <span className="resources-history-summary">
                                                {Object.entries(entry.allocations)
                                                    .map(([allocationUserId, details]) => {
                                                        const fishCount = details?.fish ?? 0;
                                                        return `U${allocationUserId}: ${fishCount}`;
                                                    })
                                                    .join(", ")}
                                            </span>
                                        </li>
                                    ))}
                            </ul>
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