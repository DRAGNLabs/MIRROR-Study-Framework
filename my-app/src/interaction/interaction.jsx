/*This page is where the users will interact with the llm*/
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom } from "../../services/roomsService";
import { getUser, getUserRole } from "../../services/usersService";
import InstructionsModal from "./InstructionsModal";
import games from "../gameLoader";


export function Interaction(){
    const location = useLocation();
    const navigate = useNavigate();
    const isAdmin = false;
    const { user } = location.state
    const { userId } = user;
    const roomCode = parseInt(user.roomCode);
    
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [canSend, setCanSend] = useState(false);
    const [hasSentThisRound, setHasSentThisRound] = useState(false);
    const isStreamingRef = useRef(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const chatBoxRef = useRef(null);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {

        async function fetchData() {
            try {
                const roomData = await getRoom(roomCode);
                const gameData = games.find(g => parseInt(g.id) === roomData.gameType);
                const { role } = await getUserRole(user.userId);
                setUserRole(gameData.roles[parseInt(role) -1]);
                setGame(games.find(g => parseInt(g.id) === roomData.gameType));
            } catch (err) {
                console.error("Failed to fetch rom:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();

    }, [roomCode])

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin, user });
        // if (!socket.connected) socket.connect();

        // const handleConnect = () => {
        //    socket.emit("join-room", { roomCode, isAdmin, user }); 
        // }

        // if (socket.connected) {
        //     handleConnect();
        // } else {
        //     socket.once("connect", handleConnect);
        // }
        // socket.on("connect", handleConnect);

        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]); 
        });

        socket.on("force-return-to-waiting-room", () => {
            navigate("/waiting", { state: { user } });
        });

        socket.on("start-user-survey", () => {
            navigate("/survey", { state: { user }});
        });

        socket.on("ai-start", () => {
            const newId = `streaming-${Date.now()}`;
            isStreamingRef.current = true;
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
            setCurrentStreamingId(null);
            setStreamingText("");
        });

        socket.on("instructions-complete", (round) => {
            setCanSend(true);
            setHasSentThisRound(false);
        });

        socket.on("round-complete", (round) => {
            setCanSend(false);
            setHasSentThisRound(true);
        });

        socket.on("game-complete", ()=> {
            setCanSend(false);
            setHasSentThisRound(true);
        });

        socket.on("force-return-to-login", () => {
            navigate("/");
        })

        // const handleLeaveRoom = () => {
        //     socket.emit("leave-room", { roomCode });
        // };

        // window.addEventListener("beforeunload", handleLeaveRoom);

        return () => {
            // handleLeaveRoom();
            // window.removeEventListener("beforeunload", handleLeaveRoom);
            // socket.off("connect", handleConnect);
            socket.off("receive-message");
            socket.off("room-users");
            socket.off("force-return-to-waiting-room");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("instructions-complete");
            socket.off("round-complete");
            socket.off("game-complete");
            socket.off("force-return-to-login");
        };
    }, []);

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);

    useEffect(() => {
        if (!streamingText || !currentStreamingId) return;

        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === currentStreamingId ? { ...msg, text: streamingText } : msg
            )
        );
    }, [streamingText,currentStreamingId]);


    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    async function getUserName(id) {
        try {
            const user = await getUser(id);
            return user;
        } catch (error) {
            console.error("Error fetching user:", error);
            return { userName: "Unknown" };
        }
    }

    async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds) {
        const newMsgs = [];
        let lastRound = -1;
        let userSentThisRound = false;
        let llmResponded = false;

        const rounds = Object.keys(llmInstructions || {}).sort((a,b) => Number(a) - Number(b));
        for (const round of rounds) {
            userSentThisRound = false;
            llmResponded = false;
            lastRound = round;
            if (llmInstructions[round]) {
                newMsgs.push({
                    sender: "llm",
                    text: llmInstructions[round],
                    id: `llm-instructions-${round}`
                });
            }
            const msgs = Array.isArray(userMessages[round]) ? userMessages[round] : [];
            for (const [msgUserId, text] of msgs) {
                const userTemp = await getUserName(msgUserId);
                newMsgs.push({
                    sender: "user",
                    msgUserId,
                    userName: userTemp.userName,
                    text
                });
                if (userId === msgUserId) {
                    userSentThisRound = true;
                }
            }
            if (llmResponse[round]) {
                llmResponded = true;
                newMsgs.push({
                    sender: "llm",
                    text: llmResponse[round],
                    id: `llm-${round}`
                });
            }
            if (parseInt(round) === parseInt(numRounds) && llmResponse[round]) {
                newMsgs.push({
                    sender: "user",
                    userName: "Admin",
                    text: "All rounds are complete, game is ended.",
                    id: "admin-end"
                });
            }
            
        }
        return {
            messages: newMsgs,
            canSend: !!llmInstructions[lastRound] && !userSentThisRound && !llmResponded,
            hasSentThisRound: userSentThisRound
        };
    }

    useEffect(() => {
        async function retrieveRoom() { 
            try {
                await delay(500);
                const room = await getRoom(roomCode);
                const llmInstructions = room.llmInstructions != null ? JSON.parse(room.llmInstructions) : {};
                const userMessages = room.userMessages != null ? JSON.parse(room.userMessages) : {};
                const llmResponse = room.llmResponse != null ? JSON.parse(room.llmResponse) : {};
                const numRounds = room.numRounds != null ? (typeof room.numRounds === "number" ? room.numRounds : JSON.parse(room.numRounds)) : 1;
                const { messages, canSend, hasSentThisRound } = await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);
                if (isStreamingRef.current) {
                    return;
                }
                setMessages(messages);
                setCanSend(canSend);
                setHasSentThisRound(hasSentThisRound);
            } catch (error){
                console.error("Error loading conversation history:", error);
            }
        }
        retrieveRoom();
    }, [roomCode]);


    const handleSubmit = async(e) => {
        e.preventDefault();
        if (!canSend || hasSentThisRound) {
            alert("You can't send a message yet");
            return;
        }

        if (!prompt.trim()) return;

        const userName = user.userName;
        socket.emit("submit-round-message", {
            roomCode,
            userId,
            userName,
            text: prompt
        });

        setPrompt("");
        setHasSentThisRound(true);
        setCanSend(false);
    };


    return (
        <>
        <div className="interactions-container">
        <header className="interaction-header">
            <button
                type="button"
                className="interaction-header-btn info-icon-button"
                title="Show conversation context"
                onClick={() => setShowInstructions(true)}
                aria-label="Show conversation context"
            >
                ⓘ
            </button>
            <h1 className="interaction-header-title">
                {user ? <>Welcome, <span className="interaction-header-name">{user.userName}</span></> : "Loading..."}
            </h1>
            <div className="interaction-header-meta">
                {user ? <span className="interaction-room-badge">Room {user.roomCode}</span> : null}
            </div>
        </header>

        <div className="chat-container">
            <div className="chat-box" ref={chatBoxRef}>
                {messages.length === 0 && (
                    <div className="chat-placeholder">
                        <p>Messages will appear here once the round starts.</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={msg.id ?? i}
                        className={`message ${msg.sender === "user" ? "message--user" : "message--bot"}`}
                    >
                        <span className="message-sender">
                            {msg.sender === "user" ? (msg?.userName || "You") : "LLM"}
                        </span>
                        <span className="message-text">{msg.text}</span>
                    </div>
                ))}
            </div>

            <form className="chat-form" onSubmit={handleSubmit}>
                <textarea
                    className="chat-input"
                    rows={1}
                    placeholder="Type your message..."
                    value={prompt}
                    onChange={(e) => {
                        setPrompt(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    aria-label="Message input"
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!canSend || hasSentThisRound}
                >
                    Send
                </button>
            </form>
        </div>
        <InstructionsModal
            open={showInstructions}
            onClose={() => setShowInstructions(false)}
            game={game}
            role={userRole}
        />
        </div>


        </>
    )

}
export default Interaction;