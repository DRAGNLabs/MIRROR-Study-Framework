/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';


export function Interaction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [canSend, setCanSend] = useState(false);
    const [hasSentThisRound, setHasSentThisRound] = useState(false);
    const isAdmin = false;

    if(!location.state) {
        console.log("User not passed through state to interactions")
        navigate("/", { replace: true });
        return null; 
    }
    const { user } = location.state
    if (!user) { 
        console.log("User not passed through state to interactions")
        navigate("/", { replace: true });
        return null;
    }

    const { userId } = user;
    const roomCode = parseInt(user.roomCode); // to make sure sockets are connecting between user and admin
    const chatBoxRef = useRef(null);


    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin, user });
        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]); 
        });

        socket.on("force-return-to-waiting-room", () => {
            navigate("/waiting", { state: { user } });
        });

        socket.on("start-user-survey", () => {
            navigate("/survey", { state: { userId, roomCode: user.roomCode }});
        });

        socket.on("ai-start", () => {
            const newId = `streaming-${Date.now()}`;
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
        <div className="welcome-center">
            {user ? <h2>Welcome, {user.userName}!</h2> : <p>Loading...</p>}
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
        {/* <div className="next-bottom-left">
            <button onClick={() => navigate("/survey", { state: { userId } })}>
            Next</button>
           
        </div> */}

        </>
    )

}
export default Interaction;