/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser, sendLLMData, calltoLLM, getUsersRoom } from '../../services/apiService';
import { socket } from '../socket';

export default function AdminInteraction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]); 
    const { room } = location.state

    const roomCode = String(room.roomCode); // to make sure sockets are connecting between user and admin
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);


    useEffect(() => {
        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]);
        });

        socket.on("force-return-to-waiting-room", () => {
            navigate("/admin/roomManagement", { state: { room } });
        });

        return () => {
            socket.off("receive-message");
            socket.off("room-users") 
            socket.off("force-return-to-waiting-room")
        };
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);


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
                <button onClick={() => navigate("/survey", { state: { userId } })}>
                Next</button>
            
            </div>
        </div>
     </>
    )

};