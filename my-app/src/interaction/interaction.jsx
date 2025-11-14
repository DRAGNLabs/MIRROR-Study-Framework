/*This page is where the users will interact with the llm*/

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser, sendLLMData, calltoLLM, getUsersRoom } from '../../services/apiService';
import { socket } from '../socket';

export function Interaction(){
    const [user, setUser] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]); 
    // const { userId, name, roomCode } = location.state || {};
    const { user: currentUser } = location.state
    const { id: userId, userName, roomCode } = currentUser;
    const [error, setError] = useState("");
    const chatBoxRef = useRef(null);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        async function fetchUser() {
            try {
                const data = await getUser(userId); // do we need this if I am passing user into state in here?

                setUser({...data, userName, roomCode});
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }
        }
        fetchUser();
    }, []);

    useEffect(() => {
        socket.on("receive-message", (msg) => {
            setMessages((prev) => [...prev, msg]);
        });

        // socket.on("room-users", (userList) => {
        // // console.log(userList);
        //     setUsers(userList);
        // });

        return () => {
            socket.off("receive-message");
            //socket.off("room-users")
        };
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    // useEffect(() => {
    //     const handleUnload = () => {
    //         socket.emit("leave-room", { roomCode, userId });
    //     };

    //     window.addEventListener("beforeunload", handleUnload);

    //     return () => {
    //         socket.emit("leave-room", { roomCode, userId });
    //         window.removeEventListener("beforeunload", handleUnload);
    //     };
    // }, []);

    // useEffect(() => {
    //     console.log("Here");
    //     socket.on("force-return-to-waiting-room", () => {
    //         navigate("/waiting", { state: { user } });
    //     });

    //     return () => socket.off("force-return-to-waiting-room");
    // }, []);

    // useEffect(() => {
    //     if (users.length < 3) {
    //         setTimeout(() => backToWait(), 800);
    //     }
    // }, [users]);

    //   function backToWait() {
    //     navigate("/waiting", {
    //         state: { currentUser }
    //     });
    // }

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
        <div className="next-bottom-left">
            <button onClick={() => navigate("/survey", { state: { userId } })}>
            Next</button>
           
        </div>

        </>
    )

}
export default Interaction;