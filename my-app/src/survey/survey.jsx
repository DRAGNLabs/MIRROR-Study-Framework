/** This page is where the user will take the survey */

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from '../../services/usersService';
import { sendSurvey  } from "../../services/surveyService";
import { getRoom } from "../../services/roomsService"
import { socket } from '../socket';
import game1 from "../games/game1.json"
import game2 from "../games/game2.json"
import game3 from "../games/game3.json"
import ConversationModal from "../interaction/ConversationModal";


const surveyMap = {
    1: game1,
    2: game2, 
    3: game3
}

export function Survey() {
    const location = useLocation();
    const { user } = location.state
    const { userId } = user;
    const roomCode = parseInt(user.roomCode); 
    const [answer, setAnswer] = useState([]);
    const [answers, setAnswers] = useState({}); 
    const [ error, setError] = useState("");
    const [survey, setSurvey] = useState(null);
    const navigate = useNavigate();
    const inputRef = useRef();
    const surveyId = 1;
    const [showConversation, setShowConversation] = useState(false);
    const [conversationMessages, setConversationMessages] = useState([]);


    async function loadSurvey(){
        const roomInfo = await getRoom(roomCode);
        const gameNumber = roomInfo.gameType; 
        const selectedSurvey = surveyMap[gameNumber];
        setSurvey(selectedSurvey);
    }

    
    useEffect(() => {
        async function loadData() {
            if (!roomCode) return;

            await loadSurvey();
            const room = await getRoom(roomCode);
            const msgs = await buildConversation(room);
            setConversationMessages(msgs);
        }

        loadData();
    }, []);


    async function handleClick(){
        if (!survey) return;

        const missing = survey.questions.filter(
            q => answers[q.id] == null || answers[q.id] === ""
        );

        if (missing.length > 0) {
            alert("Please fill out all survey questions before submitting!");
            console.log("Missing questions:", missing.map(q => q.id));
            return;
        }

        try {
            const response = await sendSurvey(1, userId, answers); // dummy surveyId, because I have no idea what surveyId is supposed to be anymore
            socket.emit("survey-complete", { roomCode, userId, surveyId });
            navigate("/exit", { state: { userId }}); 
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
         }
    }

    //If survey hasn’t loaded yet, return early to avoid crash
    if (!survey) {
        return (
        <div className="survey-container">
            <p>Survey is loading...</p>
        </div>
        );
    }

    async function buildConversation(room) {
        const llmInstructions = JSON.parse(room.llmInstructions);
        const userMessages = JSON.parse(room.userMessages);
        const llmResponses = JSON.parse(room.llmResponse);

        const rounds = Object.keys(llmInstructions).sort((a, b) => a - b);
        const messages = [];

        for (const round of rounds) {
            if (llmInstructions[round]) {
            messages.push({
                sender: "llm",
                text: llmInstructions[round]
            });
            }

            const roundMsgs = userMessages[round] || [];
            for (const [uid, text] of roundMsgs) {
            const user = await getUser(uid);
            messages.push({
                sender: "user",
                userName: user.userName,
                text
            });
            }

            if (llmResponses[round]) {
            messages.push({
                sender: "llm",
                text: llmResponses[round]
            });
            }
        }

        return messages;
    }


    return (
        <div className="survey-container">
            <div className="survey-card">
            <div className="room-top-left">
                <button
                    className="info-icon-button"
                    title="View conversation history"
                    onClick={() => setShowConversation(true)}
                >
                    ⓘ
                </button>
            </div>
            {user ? (
                <p>{user.userName} please complete the following survey of your experience from room {user.roomCode}!</p> 
            ) : ( <p>User info is loading...</p> )}
            
            {survey.questions.map(q => (
            <div key={q.id || q.label} className="survey-question">

            <p>{q.label}</p>

            {/* SELECT (yes/no etc.) */}
            <div className="form-group">
            {q.type === "select" && (
                <select
                onChange={(e) => setAnswers(prev => ({
                    ...prev, [q.id]: e.target.value
                }))}
                >
                <option value="">Select...</option>
                {q.options.map(o => (
                    <option key={o} value={o}>{o}</option>
                ))}
                </select>
            )}
            </div>

            {/* TEXT INPUT */}
            {q.type === "text" && (
                <div className="form-group">
                <input
                type="text"
                onChange={(e) => setAnswers(prev => ({
                    ...prev, [q.id]: e.target.value
                }))}
                placeholder={q.placeholder || ""}
                />
                </div>
            )}

            {/* 1–10 LITERAL SCALE SLIDER */}
            {q.type === "scale" && q.style === "slider" && (
                // <div className="form-group" >
                <div className="scale-wrapper">

                <input
                    type="range"
                    min={q.min}
                    max={q.max}
                    step={q.step}
                    value={answers[q.id] ?? q.min}
                    onChange={(e) => setAnswers(prev => ({
                    ...prev, [q.id]: Number(e.target.value)
                    })
                )}
                />
                <div className="scale-labels">
                    <span className="left-label">{q.leftLabel}</span>
                    <span className="selected-number">{answers[q.id] ?? q.min}</span>
                    <span className="right-label">{q.rightLabel}</span>
                </div>
                </div>
                // </div>
            )}
            </div>
        ))}

            <div className="button-group">
                <button onClick={handleClick}>
                    Submit
                </button>
                </div>

      
            </div>
        <ConversationModal
            open={showConversation}
            onClose={() => setShowConversation(false)}
            messages={conversationMessages}
        />
        </div>
    )
}

export default Survey;