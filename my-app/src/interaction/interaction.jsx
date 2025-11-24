/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// import { getUser, sendLLMData, calltoLLM, getUsersRoom } from '../../services/apiService';
import { socket } from '../socket';

export function Interaction(){
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState(""); 
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
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
            navigate("/survey", { state: { userId }});
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
            console.log("AI finished typing");
            setCurrentStreamingId(null);
            setStreamingText("");
        });

        // socket.on("force-to-login", () => {
        //     navigate("/");
        // });

        return () => {
            socket.off("receive-message");
            socket.off("room-users");
            socket.off("force-return-to-waiting-room");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            // socket.off("force-to-login");
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

        if (!prompt.trim()) return;

        const userMsg = { sender: "user", text: prompt, userName: user.userName };
        setMessages((prev) => [...prev, userMsg]);
        socket.emit("send-message", { roomCode, message: userMsg });
        socket.emit("generate-ai",  { roomCode, prompt });
        setPrompt("");
    };

    //     try {
    //         // After we're saving rooms 
    //         // const roomInfo = await getUsersRoom(roomCode);
    //         // console.log(roomUsers);
    //         // const roomUsers = roomInfo.users
    //         // Write code to loop through roomUsers and check that they have all sent a message
    //         // setMessages(prev => [
    //         //     ...prev,
    //         //     { sender: "assistant", content: "" }
    //         // ]);
    //         // await callToLLM(prompt, (token) => {
    //         //     setMessages(prev => {
    //         //         const last = prev[prev.length - 1]

    //         //         return [
    //         //             ...prev.slice(0,-1),
    //         //             {...last, content: last.content + token}
    //         //         ];
    //         //     });
    //         // });

    //         // setTimeout(() => {
    //         //     const finalMessage = messagesRef.current[messagesRef.current.length - 1];
    //         //     socket.emit("send-message", {
    //         //         roomCode,
    //         //         message: finalMessage
    //         //     });
    //         // }, 0);

    //         socket.on("ai-start", () => {
    //             setMessages(prev => [
    //                 ...prev,
    //                 { sender: "llm", text: "", id: "streaming" }
    //             ]);
    //         });

    //         socket.on("ai-token", (token) => {
    //             setMessages(prev => {
    //                 const last = prev[prev.length-1];
    //                 return[
    //                     ...prev.slice(0,-1),
    //                     {...last, text: last.text + token}
    //                 ];
    //             });
    //         });

    //         socket.on("ai-end", () => {
    //             console.log("AI finished typing");
    //         });


    //         // const response = await calltoLLM(userId, prompt);
    //         // const llmMsg = response;
    //         // //NOT OFFICIALLY SET UP YET
    //         // //console.log(`LLM response: ${JSON.stringify(response)}`);
    //         // //const llmMsg = { sender: "llm", text: response || "(no response)" };
    //         // // const llmMsg = { sender: "llm", text: "okay" };
    //         // setMessages((prev) => [...prev, llmMsg])

    //         // socket.emit("send-message", { roomCode: roomCode, message: llmMsg});
    //         // const success = await sendLLMData(user.name, prompt, response.response); ALSO NOT SET UP YET
    //         //console.log(`Data sent to backend `); //${success.message}
    //     } catch (err) {
    //         console.error("Error:", err);
    //         setError(err.message || "Something went wrong.");
    //     }
    // }

    // const handleKeyDown = (e) => {
    //     if(e.key === "Enter"){
    //         e.preventDefault();
    //         handleSubmit(e);
    //     }
    // }

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
            // onKeyDown={handleKeyDown}
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