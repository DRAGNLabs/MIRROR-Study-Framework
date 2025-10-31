import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser, sendLLMData, calltoLLM } from '../../services/apiService';


export function Interaction(){
    const [user, setUser] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]); 
    const { userId } = location.state || {};
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);

    useEffect(() => {
        async function fetchUser() {
            try {
                const data = await getUser(userId);
                console.log(data.userName);
                console.log(data.roomCode);
                setUser(data);
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }
        }
        fetchUser();
    }, []);

    useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);


    async function handleSubmit(e){
        e.preventDefault();
        console.log(user);

        if (!user.userName || !prompt.trim()) return;

        const userMsg = { sender: "user", text: prompt };
        setMessages((prev) => [...prev, userMsg]);
        setPrompt("");

        try {
            //const response = await calltoLLM(user.userName, prompt); NOT OFFICIALLY SET UP YET
            const response = {"response": "okay"};
            console.log(`prompt: ${prompt}`);
            console.log(`LLM response: ${JSON.stringify(response.response)}`);
            const llmMsg = { sender: "llm", text: response.response || "(no response)" };
            setMessages((prev) => [...prev, llmMsg]);

            // Optional: log the exchange to your backend
            // const success = await sendLLMData(user.name, prompt, response.response); ALSO NOT SET UP YET
            console.log(`Data sent to backend `); //${success.message}
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
         }
    }

    const handleKeyDown = (e) => {
        console.log("Key pressed:", e.key);
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
        <div className="chat-box" id="chat-box" ref={chatBoxRef}>
            {
                messages.map((msg, i) => (
                    <div
              key={i}
              className={`chat-message ${
                msg.sender === "user" ? "user-message" : "llm-message"
              }`}
            >
              {msg.sender === "user"
                ? `${user?.userName || "User"}: ${msg.text}`
                : `LLM: ${msg.text}`}
            </div>
                ))
            }
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
        <div className="next-bottom-left">
            <button onClick={() => navigate("/survey", { state: { userId } })}>
            Next</button>
           
        </div>

        </>
    )

}
export default Interaction;