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
        // socket.emit("join-room", { roomCode, isAdmin, user });
        // if (!socket.connected) socket.connect();

        const handleConnect = () => {
           socket.emit("join-room", { roomCode, isAdmin, user }); 
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }
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

        socket.on("status", (status) => {
            const currentPath = location.pathname;
            console.log("Current path name in interaction", currentPath);
            console.log("status", status);
            if(!currentPath.includes(status)) {
                navigate(`/${status}`, { state: { user } });
            }
        });
            // const handleLeaveRoom = () => {
        //     socket.emit("leave-room", { roomCode });
        // };

        // window.addEventListener("beforeunload", handleLeaveRoom);

        return () => {
            // handleLeaveRoom();
            // window.removeEventListener("beforeunload", handleLeaveRoom);
            socket.off("connect", handleConnect);
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
            socket.off("status");
        };
    }, [socket]);

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
            console.error("Error:", error);
            setError(error.message || "something went wrong.");
        }
    }

    async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds) {
        const newMsgs = [];
        let lastRound = -1;
        let userSentThisRound = false;
        let llmResponded = false;

        const rounds = Object.keys(llmInstructions).sort((a,b) => a-b);
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
            const msgs = userMessages[round] || [];
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
                    text: "All rounds are complete, game is ended."
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
            // if (isStreamingRef.current) {
            //     console.log("Skipping database fetch during stream");
            //     return;
            // }

            // if (hasFetchedInitialData.current) {
            //     return;
            // }

            try {
                await delay(1000);
                const room = await getRoom(roomCode);
                let llmInstructions = JSON.parse(room.llmInstructions);
                let userMessages = JSON.parse(room.userMessages);
                let llmResponse = JSON.parse(room.llmResponse);
                let numRounds = JSON.parse(room.numRounds);
                const { messages, canSend, hasSentThisRound } = await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);
                if (isStreamingRef.current) {
                    // console.log("SKIP database");
                    console.log("Skipping DB fetch during stream");
                    return;
                }
                setMessages(messages);
                setCanSend(canSend);
                setHasSentThisRound(hasSentThisRound);
            } catch (error){
                console.error("Error:", error);
                setError(error.message || "Something went wrong.");
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
;
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
        <div className="welcome-center">
            {user ? <h2>Welcome, {user.userName}!</h2> : <p>Loading...</p>}
        </div>

        <div className="room-top-left">
            <button
                className="info-icon-button"
                title="Show instructions"
                onClick={() => setShowInstructions(true)}
                >
                ⓘ
            </button>
        </div>

        <div className="room-top-right">
            {user ? <p>Room: {user.roomCode}</p> : null}
        </div>
        <div className="chat-container">


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

        <form id="chat-form" onSubmit={handleSubmit}>
           <textarea
            id="chat-input"
            rows="1"
            placeholder="Type a message..."
            value={prompt}
            onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto"; // reset height
                e.target.style.height = e.target.scrollHeight + "px"; // set to content height
            }}
            />
        <button type="submit" disabled={!canSend || hasSentThisRound}>Send</button>
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