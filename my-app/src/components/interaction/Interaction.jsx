/*This page is where the users will interact with the llm*/
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { socket } from '../../socket';
import { formatTime } from "./interactionUtils";
import InstructionsModal from "./InstructionsModal"
import ChatBox from "./ChatMessages";
import ResourcesPanel from "./ResourcePanel";
import './interaction.css'
import { useInteractionSocket } from "./interactionSocket";


export function Interaction(){
    const location = useLocation();
    // const navigate = useNavigate();
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
    const [timeRemaining, setTimeRemaining] = useState(null);

    const [showInstructions, setShowInstructions] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [game, setGame] = useState(null);
    // const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [resourceHistory, setResourceHistory] = useState([]);

    const isStreamingRef = useRef(false);
    const timerIntervalRef = useRef(null);
    const loadCurrUserMessages = useRef(false);
    const chatBoxRef = useRef(null);
    const timerBarRef = useRef(null);
    // const delay = ms => new Promise(resolve => setTimeout(resolve, ms));



    useInteractionSocket(
        roomCode, 
        isAdmin, 
        user, 
        isStreamingRef, 
        timerIntervalRef, 
        loadCurrUserMessages, 
        setMessages, 
        setResourceHistory, 
        setTimeRemaining, 
        setStreamingText, 
        setCurrentStreamingId, 
        setCanSend, 
        setHasSentThisRound, 
        setGame, 
        setUserRole
    );

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


    useEffect(() => {
        if (!window.visualViewport || timeRemaining === null) return;
        const update = () => {
            if (timerBarRef.current) {
                timerBarRef.current.style.top = `${window.visualViewport.offsetTop}px`;
            }
        };
        window.visualViewport.addEventListener('resize', update);
        window.visualViewport.addEventListener('scroll', update);
        return () => {
            window.visualViewport.removeEventListener('resize', update);
            window.visualViewport.removeEventListener('scroll', update);
        };
    }, [timeRemaining]);


    const handleSubmit = async(e) => {
        e.preventDefault();
        if (!canSend || hasSentThisRound) {
            alert("You can't send a message yet");
            return;
        }

        if (!prompt.trim()) return;

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
        {/* <div className="interactions-container"> */}
        <div className={`interactions-container ${timeRemaining !== null ? 'has-timer' : ''}`}>
        {timeRemaining !== null && (
            <div ref={timerBarRef} className={`mobile-timer-bar ${timeRemaining <= 30 ? 'urgent' : ''}`}>
                ⏱ Time remaining: {formatTime(timeRemaining)}
            </div>
        )}
        
      

        <header className="interaction-header">
            <button
                type="button"
                className="info-button"
                // className="interaction-header-btn info-icon-button"
                title="Show conversation context"
                onClick={() => setShowInstructions(true)}
                aria-label="Show conversation context"
            >
                Instructions
            </button>

            <h1 className="interaction-header-title">
                {user ? <>Welcome, <span className="interaction-header-name">{user.userName}</span></> : "Loading..."}
            </h1>
            <div className="interaction-header-meta">
                {/* {user ? <span className="interaction-room-badge">Room {user.roomCode}</span> : null} */}
                <button
                    className="resources-toggle-btn-header"
                    onClick={() => setShowResources(true)}
                >
                    Resources
                </button>
            </div>
        </header>

        <div className="interaction-main-layout">

            <ResourcesPanel
                resourceHistory={resourceHistory}
                timeRemaining={timeRemaining}
                formatTime={formatTime}
                currentUserName={user.userName}
                isAdmin={false}
                showResources={showResources}
                onClose={() => setShowResources(false)}
            />

            <div className="chat-container" >
                <ChatBox
                    messages={messages}
                    chatBoxRef={chatBoxRef}
                />

                <form className="chat-form" onSubmit={handleSubmit}>
                    <textarea
                        className="chat-input"
                        rows={1}
                        placeholder="Type your message..."
                        value={prompt}
                        onChange={(e) => {
                            setPrompt(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        aria-label="Message input"
                    />
                    <button
                        type="submit"
                        className="chat-send-btn"
                        disabled={!canSend || hasSentThisRound}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
        </div>
        <InstructionsModal
            open={showInstructions}
            onClose={() => setShowInstructions(false)}
            game={game}
            role={userRole}
            timeRemaining={timeRemaining}
            formatTime={formatTime}
        />
        </>
    )

}
export default Interaction;