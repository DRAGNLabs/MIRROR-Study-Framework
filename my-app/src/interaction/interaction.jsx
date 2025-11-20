/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser, sendLLMData, calltoLLM, getUsersRoom } from '../../services/apiService';
import { socket } from '../socket';

export function Interaction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]); 
    const { user } = location.state
    if (!user) { 
        navigate("/", { replace: true });
        return null;
    }

    const { userId } = user;
    const roomCode = String(user.roomCode); // to make sure sockets are connecting between user and admin
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);


    useEffect(() => {
        socket.on("receive-message", (message) => {
            setMessages((prev) => [...prev, message]);
        });

        socket.on("force-return-to-waiting-room", () => {
            navigate("/waiting", { state: { user } });
        });

        socket.on("startUserSurvey", () => {
            navigate("/survey", { state: { user }});
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

    const handleSubmit = async(e) => {
        e.preventDefault();

        if (!user.userName || !prompt.trim()) return;

        const userMsg = { sender: "user", text: prompt, userName: user.userName };
        setMessages((prev) => [...prev, userMsg]);
        socket.emit("send-message", { roomCode: user.roomCode, message: userMsg });

        setPrompt("");

        try {
            // After we're saving rooms 
            // const roomInfo = await getUsersRoom(roomCode);
            // console.log(roomUsers);
            // const roomUsers = roomInfo.users
            // Write code to loop through roomUsers and check that they have all sent a message


            //const response = await calltoLLM(user.userName, prompt); NOT OFFICIALLY SET UP YET
            //console.log(`LLM response: ${JSON.stringify(response)}`);
            //const llmMsg = { sender: "llm", text: response || "(no response)" };
            const llmMsg = { sender: "llm", text: "okay" };
            setMessages((prev) => [...prev, llmMsg])

            socket.emit("send-message", { roomCode: roomCode, message: llmMsg})
            // const success = await sendLLMData(user.name, prompt, response.response); ALSO NOT SET UP YET
            //console.log(`Data sent to backend `); //${success.message}
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
        }
    }

    const handleKeyDown = (e) => {
        if(e.key === "Enter"){
            e.preventDefault();
            handleSubmit(e);
        }
    }

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
            onKeyDown={handleKeyDown}
            />
        <button type="submit">Send</button>
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