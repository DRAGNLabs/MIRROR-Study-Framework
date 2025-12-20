/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom } from '../../services/roomsService.js'

export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [users, setUsers] =useState([]);
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]); 
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [currRound, setCurrRound] = useState(1);
    const [numRounds, setNumRounds] = useState(0);
    const [room, setRoom] = useState();
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);
    // const isAdmin = true;
    const { roomCode } = location.state;

    useEffect(() => {
        if (!roomCode) {
            navigate("/admin", { replace: true});
            return;
        }
    }, [roomCode, navigate]);

    useEffect(() => {
        retrieveRoom();
    }, [roomCode]);


    async function retrieveRoom() { 
        try {
            const response = await getRoom(roomCode);
            // console.log(response);
            setRoom(response);
        } catch (error){
            console.error("Error:", error);
            setError(error.message || "Something went wrong.");
        }
    }


    useEffect(() => {
        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]);
            console.log(messages);
        });

        socket.on("force-return-to-waiting-room", () => {
            navigate("/admin/roomManagement", { state: { room } });
        });

        socket.on("ai-start", () => {
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
            console.log("AI finished typing");
            // const llmMessage = { sender: "llm", id: "", text: streamingText }
            // setMessages((prev) => [...prev, llmMessage]);
            setCurrentStreamingId(null);
            setStreamingText("");
        });

        // socket.on("instructions-complete", (round) => { // might not need this on admin side
        //     setCurrRound(round); // probably don't need this at all
        // });

        socket.on("room-users", setUsers);

        socket.on("round-complete", (nextRound) => {
            console.log("Next round from server:", nextRound);
            socket.emit('start-round', {
                roomCode,
                round: nextRound
                // prompt: gameInfo["prompts"][0]["instruction_system"]
            });
        });

        return () => {
            socket.off("receive-message");
            socket.off("room-users");
            socket.off("force-return-to-waiting-room");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            // socket.off("instructions-complete");
            socket.off("room-users");
            socket.off("round-complete");
        };
    }, []);

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

    function toSurvey() {
        socket.emit("startSurvey", { roomCode });
    }


    return (
        <>
        <div className="admin-message-container">
            <h1>Welcome Admin!</h1>
        <div className="room-top-right">
            <p>Room: {roomCode}</p>
        </div>
        <div className="admin-chat-container">


            <div className="admin-chat-box" ref={chatBoxRef}>
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

        </div>
            <div className="admin-next-bottom-left">
                <button onClick={toSurvey}>Next</button>
            </div>
        </div>
     </>
    )

};