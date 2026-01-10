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

const surveyMap = {
    1: game1,
    2: game2, 
    3: game3
}

export function Survey() {
    const [user, setUser] = useState(null);
    const location = useLocation();
    let { userId, roomCode } = location.state; //the userId is passed from the previous 
    // page although i need to double check and make sure this is still working
    roomCode = parseInt(roomCode);
    const [answer, setAnswer] = useState([]);
    const [answers, setAnswers] = useState({}); 
    const [ error, setError] = useState("");
    const [survey, setSurvey] = useState(null);
    const navigate = useNavigate();
    const inputRef = useRef();
    const surveyId = 1;


    //getGameNumber from the room information
    async function loadSurvey(){
        const roomInfo = await getRoom(roomCode);
        const gameNumber = roomInfo.gameType; //this should change when we change the database storing the 1 game that was selected.
        const selectedSurvey = surveyMap[gameNumber];
        setSurvey(selectedSurvey);
        // setSurvey(game1);
    }

    

    useEffect(() => {
        if (roomCode){
            loadSurvey();
        }

        async function fetchUser() {
            try {
                const data = await getUser(userId);
                setUser(data);
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }
        }
        fetchUser();


    }, []);

    //handles click when the enter button is pressed
    // const handleKeyDown = (e) => {
    //     if (e.key === "Enter") {
    //     e.preventDefault();
    //     if (first && second && third) {
    //         const updated = [...answer, {first, second, third }]; //maybe find a way to store that
    //         // data in the db with a number associate to it to know which question?
    //         setAnswer(updated);
    //         handleClick(updated);
    //         } else {
    //             alert("Please fill in both answers before submitting!");
    //         }
    //     }
    // };

    async function handleClick(){
        // console.log(user);
        // async () => {
        //             const missing = survey.questions.filter(q => answers[q.id] == null || answers[q.id] === "");
                    
        //             if (missing.length > 0) {
        //                 alert("Please fill out all survey questions before submitting!");
        //                 console.log("Missing questions:", missing.map(q => q.id));
        //                 return;
        //             }

        //             try {
        //                 await sendSurvey(1, userId, answers);
        //                 socket.emit("survey-complete", { roomCode, userId, surveyId });
        //                 navigate("/exit");
        //             } catch (err) {
        //                 console.error("Survey submit failed:", err);
        //                 setError("Failed to send survey.");
        //             }
        //             }}
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
            const response = await sendSurvey(1, userId, answers); // dummy surveyId, also will have to change structure of updated
            socket.emit("survey-complete", { roomCode, userId, surveyId });
            navigate("/exit");
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


    return (
        //survey using dumby questions and dumby data that will be sent.
        <div className="survey-container">
            {user ? (
                <p>{user.userName} please complete the following survey of your experience from room {user.roomCode}!</p> 
            ) : ( <p>User info is loading...</p> )}
            {survey.questions.map(q => (
            <div key={q.id || q.label} className="survey-question">

            <p>{q.label}</p>

            {/* SELECT (yes/no etc.) */}
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

            {/* TEXT INPUT */}
            {q.type === "text" && (
                <input
                type="text"
                onChange={(e) => setAnswers(prev => ({
                    ...prev, [q.id]: e.target.value
                }))}
                placeholder={q.placeholder || ""}
                />
            )}

            {/* 1–10 LITERAL SCALE SLIDER */}
            {q.type === "scale" && q.style === "slider" && (
                <div className="scale-wrapper">
                <span className="end-label">{q.leftLabel || q.leftLable}</span>

                <input
                    type="range"
                    min={q.min}
                    max={q.max}
                    step={q.step}
                    value={answers[q.id] >> q.min}
                    onChange={(e) => setAnswers(prev => ({
                    ...prev, [q.id]: Number(e.target.value)
                    }))}
                />

                <span className="end-label">{q.rightLabel}</span>
                <span className="selected-number">
                    {answers[q.id] ?? q.min}
                </span>
                </div>
            )}
            </div>
        ))}

            <div className="button-group">
                <button onClick={handleClick}
                    //     async () => {
                    // const missing = survey.questions.filter(q => answers[q.id] == null || answers[q.id] === "");
                    
                    // if (missing.length > 0) {
                    //     alert("Please fill out all survey questions before submitting!");
                    //     console.log("Missing questions:", missing.map(q => q.id));
                    //     return;
                    // }

                    // try {
                    //     await sendSurvey(1, userId, answers);
                    //     socket.emit("survey-complete", { roomCode, userId, surveyId });
                    //     navigate("/exit");
                    // } catch (err) {
                    //     console.error("Survey submit failed:", err);
                    //     setError("Failed to send survey.");
                    // }
                   // }}
                >
                    Submit
                </button>
                </div>


        </div>
    )
}

export default Survey;