/** This page is where the user will take the survey */

import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from '../../services/usersService';
import { sendSurvey  } from "../../services/surveyService";
import { getRoom } from "../../services/roomsService"
import { socket } from '../socket';
import games from "../gameLoader";
import ConversationModal from "./ConversationModal";

function buildDisplaySteps(questions) {
    const steps = [];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q.type === "label" && questions[i + 1]?.type === "scale") {
            steps.push({ sectionLabel: q, question: questions[i + 1] });
            i++;
        } else if (q.type !== "label") {
            steps.push({ question: q });
        }
    }
    return steps;
}

function formatAnswer(q, answers) {
    const val = answers[q.id];
    if (val == null || val === "") return "(No response)";
    if (q.type === "select") return String(val);
    if (q.type === "scale") return String(val);
    return String(val);
}

export function Survey() {
    const location = useLocation();
    const { user } = location.state;
    const { userId } = user;
    const roomCode = parseInt(user.roomCode);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState("");
    const [survey, setSurvey] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [fromReview, setFromReview] = useState(false);
    const navigate = useNavigate();
    const surveyId = 1;
    const [showConversation, setShowConversation] = useState(false);
    const [conversationMessages, setConversationMessages] = useState([]);

    const displaySteps = useMemo(
        () => (survey ? buildDisplaySteps(survey.questions) : []),
        [survey]
    );

    const totalSteps = displaySteps.length + 1;
    const isReviewStep = currentStep === displaySteps.length;
    const currentDisplayStep = displaySteps[currentStep];
    const currentQuestion = currentDisplayStep?.question;

    async function loadSurvey() {
        const roomData = await getRoom(roomCode);
        const selectedSurvey = games.find(g => parseInt(g.id) === roomData.gameType);
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
                const userData = await getUser(uid);
                messages.push({
                    sender: "user",
                    userName: userData.userName,
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

    async function handleClick() {
        if (!survey) return;

        const missing = survey.questions.filter(
            q => q.type !== "label" && (answers[q.id] == null || answers[q.id] === "")
        );

        if (missing.length > 0) {
            alert("Please fill out all survey questions before submitting!");
            return;
        }

        try {
            await sendSurvey(1, userId, answers);
            socket.emit("survey-complete", { roomCode, userId, surveyId });
            navigate("/exit", { state: { userId } });
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
        }
    }

    function handleNext() {
        if (fromReview) {
            setCurrentStep(displaySteps.length);
            setFromReview(false);
            return;
        }
        if (isReviewStep) {
            handleClick();
            return;
        }
        if (currentStep === displaySteps.length - 1) {
            setCurrentStep(displaySteps.length);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    }

    function handlePrev() {
        if (currentStep === displaySteps.length) {
            setCurrentStep(displaySteps.length - 1);
            return;
        }
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }

    function handleEdit(index) {
        setCurrentStep(index);
        setFromReview(true);
    }

    if (!survey) {
        return (
            <div className="survey-container">
                <p>Survey is loading...</p>
            </div>
        );
    }

    const progress = totalSteps > 0
        ? ((currentStep + 1) / totalSteps) * 100
        : 0;
    const isFirst = currentStep === 0;
    const isLastQuestion = currentStep === displaySteps.length - 1 && !isReviewStep;
    const showSubmit = isReviewStep;

    return (
        <div className="survey-container">
            <div className="survey-progress-wrapper">
                <div className="survey-progress-bar">
                    <div
                        className="survey-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="survey-progress-text">
                    {isReviewStep
                        ? `Review (${currentStep + 1} of ${totalSteps})`
                        : `Question ${currentStep + 1} of ${totalSteps}`}
                </span>
            </div>

            <div className="survey-card">
                <div className="room-top-left">
                    <button
                        className="info-icon-button"
                        title="View conversation history"
                        onClick={() => setShowConversation(true)}
                    >
                        i
                    </button>
                </div>

                {user ? (
                    <p className="survey-intro">
                        {user.userName}, please complete the following survey of your experience from room {user.roomCode}.
                    </p>
                ) : (
                    <p>User info is loading...</p>
                )}

                {isReviewStep ? (
                    <div className="survey-review">
                        <h3 className="survey-review-title">Review your answers</h3>
                        <p className="survey-review-subtitle">You can edit any response before submitting.</p>
                        <ul className="survey-review-list">
                            {displaySteps.map((step, index) => {
                                const isUnanswered = answers[step.question.id] == null || answers[step.question.id] === "";
                                return (
                                    <li
                                        key={step.question.id}
                                        className={`survey-review-item ${isUnanswered ? "survey-review-item--unanswered" : ""}`}
                                    >
                                        <div className="survey-review-item-content">
                                            <span className="survey-review-question">{step.question.label}</span>
                                            <span className={`survey-review-answer ${isUnanswered ? "survey-review-answer--empty" : ""}`}>
                                                {formatAnswer(step.question, answers)}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className={isUnanswered ? "survey-review-edit-btn survey-review-edit-btn--answer" : "survey-review-edit-btn"}
                                            onClick={() => handleEdit(index)}
                                        >
                                            {isUnanswered ? "Answer" : "Edit"}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : (
                    <div key={currentQuestion?.id || currentQuestion?.label} className="survey-question-step">
                        {currentDisplayStep.sectionLabel && (
                            <p className="survey-section-label">{currentDisplayStep.sectionLabel.label}</p>
                        )}
                        <p className="survey-question-label">{currentQuestion.label}</p>

                        {currentQuestion.type === "select" && (
                            <div className="form-group">
                                <select
                                    value={answers[currentQuestion.id] ?? ""}
                                    onChange={(e) => setAnswers(prev => ({
                                        ...prev, [currentQuestion.id]: e.target.value
                                    }))}
                                >
                                    <option value="">Select...</option>
                                    {currentQuestion.options.map(o => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {currentQuestion.type === "text" && (
                            <div className="form-group">
                                {currentQuestion.id === "age" || currentQuestion.label?.toLowerCase().includes("age") ? (
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={120}
                                        step={1}
                                        value={answers[currentQuestion.id] ?? ""}
                                        onChange={(e) => setAnswers(prev => ({
                                            ...prev, [currentQuestion.id]: e.target.value
                                        }))}
                                        placeholder={currentQuestion.placeholder || ""}
                                    />
                                ) : (
                                    <textarea
                                        rows={6}
                                        value={answers[currentQuestion.id] ?? ""}
                                        onChange={(e) => setAnswers(prev => ({
                                            ...prev, [currentQuestion.id]: e.target.value
                                        }))}
                                        placeholder={currentQuestion.placeholder || "Type your response here..."}
                                    />
                                )}
                            </div>
                        )}

                        {currentQuestion.type === "scale" && currentQuestion.style === "slider" && (
                            <div className="scale-wrapper">
                                <input
                                    type="range"
                                    min={currentQuestion.min}
                                    max={currentQuestion.max}
                                    step={currentQuestion.step}
                                    value={answers[currentQuestion.id] ?? currentQuestion.min}
                                    onChange={(e) => setAnswers(prev => ({
                                        ...prev, [currentQuestion.id]: Number(e.target.value)
                                    }))}
                                />
                                <div className="scale-labels">
                                    <span className="left-label">{currentQuestion.leftLabel}</span>
                                    <span className="selected-number">{answers[currentQuestion.id] ?? currentQuestion.min}</span>
                                    <span className="right-label">{currentQuestion.rightLabel}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="survey-nav">
                    <button
                        className="survey-nav-btn survey-nav-prev"
                        onClick={handlePrev}
                        disabled={isFirst && !isReviewStep}
                        type="button"
                    >
                        Back
                    </button>
                    <button
                        className="survey-nav-btn survey-nav-next"
                        onClick={handleNext}
                        type="button"
                    >
                        {showSubmit
                            ? "Submit"
                            : fromReview
                                ? "Back to Review"
                                : isLastQuestion
                                    ? "Review Answers"
                                    : "Next"}
                    </button>
                </div>

                {error && <p className="survey-error">{error}</p>}
            </div>

            <ConversationModal
                open={showConversation}
                onClose={() => setShowConversation(false)}
                messages={conversationMessages}
            />
        </div>
    );
}

export default Survey;
