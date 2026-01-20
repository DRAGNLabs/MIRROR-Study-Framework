/*This page is where the users will interact with the llm*/
import { Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom } from "../../services/roomsService";
import { getUser } from "../../services/usersService";
import InstructionsModal from "./InstructionsModal";
import game1 from "../games/game1.json";
import game2 from "../games/game2.json";
import game3 from "../games/game3.json"

const gameMap = {
    1: game1,
    2: game2,
    3: game3
}


export function Interaction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [canSend, setCanSend] = useState(false);
    const [hasSentThisRound, setHasSentThisRound] = useState(false);
    const isStreamingRef = useRef(false);
    const isAdmin = false;
    const { user } = location.state
    const { userId } = user;
    const roomCode = parseInt(user.roomCode); // to make sure sockets are connecting between user and admin
    const chatBoxRef = useRef(null);
    const [showInstructions, setShowInstructions] = useState(false);

    const game = gameMap[1]; // TEMP: replace with room.gameType
    const role = {
        role: "shepherd",
        backstory: "people keep scattering your flock",
        drawbacks: "you're allergic to sheep"
    };

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin, user });
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

        return () => {
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
                console.log("username:", userTemp);
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
            if (parseInt(round) === parseInt(numRounds)) {
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
            try {
                const room = await getRoom(roomCode);
                let llmInstructions = JSON.parse(room.llmInstructions);
                let userMessages = JSON.parse(room.userMessages);
                let llmResponse = JSON.parse(room.llmResponse);
                let numRounds = JSON.parse(room.numRounds);
                const { messages, canSend, hasSentThisRound } = await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);
                if (isStreamingRef.current) {
                    console.log("SKIP database");
                    console.warn("Skipping DB fetch during stream");
                    return;
                }
                setMessages(messages);
                setCanSend(canSend);
                setHasSentThisRound(hasSentThisRound);
                // setRoom(room);
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
            role={role}
        />
        </div>


        </>
    )

}
export default Interaction;