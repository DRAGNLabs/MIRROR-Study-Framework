/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket.js';
import { getRoom, updateStatus } from '../../services/roomsService.js'
import { getUser } from '../../services/usersService.js'

export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [users, setUsers] =useState([]);
    const [messages, setMessages] = useState([]); 
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [room, setRoom] = useState();
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);
    const { roomCode } = location.state;
    const isStreamingRef = useRef(false);
    const isAdmin = true;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin});
        // if (!socket.connected) socket.connect();

        // const handleConnect = () => {
        //    socket.emit("join-room", { roomCode, isAdmin}); 
        // }

        // socket.on("connect", handleConnect);

        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]);
        });


        socket.on("ai-start", () => {
            console.log("HERE in ai-start");
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
            setCurrentStreamingId(null);
            setStreamingText("");
        });

        socket.on("room-users", setUsers);

        socket.on("round-complete", (nextRound) => {
            // console.log("Next round from server:", nextRound);
            socket.emit('start-round', {
                roomCode,
                round: nextRound
            });
        });

        socket.on("force-return-to-login", () => {
            navigate("/admin");
        });


        return () => {
            // socket.off("connect", handleConnect);
            socket.off("receive-message");
            socket.off("room-users");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("round-complete");
            socket.off("force-return-to-login");
        };
    }, [roomCode]);

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);

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
            setError(error.message || "something went wrong.");
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


    useEffect(() => {

        async function retrieveRoom() {
            try {
                await delay(1000); // this makes sure the messages don't get reset before llmInstructions have sent
                const room = await getRoom(roomCode);
                let llmInstructions = JSON.parse(room.llmInstructions);
                let userMessages = JSON.parse(room.userMessages);
                let llmResponse = JSON.parse(room.llmResponse);
                let numRounds = JSON.parse(room.numRounds);
                const newMsgs =  await resetMessages(llmInstructions, userMessages, llmResponse, numRounds);
                if (isStreamingRef.current) {
                    console.log("SKIP database");
                    console.warn("Skipping DB fetch during stream");
                    return;
                }
                setMessages(newMsgs);
                // hasInitialized.current = true;
                setRoom(room);
            } catch (error){
                console.error("Error:", error);
                setError(error.message || "Something went wrong.");
            }
        }

        retrieveRoom();

    }, [roomCode]);

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