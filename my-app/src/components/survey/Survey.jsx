/** This page is where the user will take the survey */

import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sendSurvey } from "../../services/surveyService";
import { getRoom } from "../../services/roomsService";
import { socket } from '../../socket'
import games from "../../gameLoader";
import ConversationModal from "./ConversationModal";
import ConversationReflectionStep from "./ConversationReflectionStep";
import { SortRankList } from "./SortRankList";
import { buildConversation, buildDisplaySteps, displayStepHasUnanswered, formatAnswer, isRequiredQuestionUnanswered } from "./surveyUtils";
import './survey.css'


export function Survey() {
    const location = useLocation();
     const navigate = useNavigate();
    const { user } = location.state;
    const { userId } = user;
    const roomCode = parseInt(user.roomCode);

    const storageKey = `survey_${roomCode}_${userId}`;
    const [answers, setAnswers] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : {};
    });
    const [error, setError] = useState("");
    const [survey, setSurvey] = useState(null);
    const [currentStep, setCurrentStep] = useState(() => {
        const savedStep = localStorage.getItem(`${storageKey}_step`);
        return savedStep ? parseInt(savedStep, 10) : 0;
    });
    const [fromReview, setFromReview] = useState(false);
    const [showConversation, setShowConversation] = useState(false);
    const [conversationMessages, setConversationMessages] = useState([]);
    const [conversationMarks, setConversationMarks] = useState(() => {
        const saved = localStorage.getItem(`${storageKey}_marks`);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(answers));
    }, [answers, storageKey]);

    useEffect(() => {
        localStorage.setItem(`${storageKey}_step`, currentStep.toString());
    }, [currentStep, storageKey]);
 
    useEffect(() => {
        localStorage.setItem(`${storageKey}_marks`, JSON.stringify(conversationMarks));
    }, [conversationMarks, storageKey]);

    const displaySteps = useMemo(
        () => (survey ? buildDisplaySteps(survey.questions) : []),
        [survey]
    );

    const totalSteps = displaySteps.length + 2;
    const isReflectionStep = currentStep === 0;
    const isReviewStep = currentStep === displaySteps.length + 1;
    const currentDisplayStep =
        currentStep >= 1 && currentStep <= displaySteps.length
            ? displaySteps[currentStep - 1]
            : null;
    const primaryQuestion = currentDisplayStep?.questions?.[0] ?? currentDisplayStep?.question ?? null;
    const currentQuestions = currentDisplayStep
        ? currentDisplayStep.questions ?? (currentDisplayStep.question ? [currentDisplayStep.question] : [])
        : [];

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

    // Initialize sortRank answer to option order when first viewing the question
    useEffect(() => {
        if (!primaryQuestion || primaryQuestion.type !== "sortRank" || !primaryQuestion.options?.length) return;
        const current = answers[primaryQuestion.id];
        if (Array.isArray(current) && current.length === primaryQuestion.options.length) return;
        setAnswers(prev => ({
            ...prev,
            [primaryQuestion.id]: [...(primaryQuestion.options)]
        }));
    }, [primaryQuestion?.id, primaryQuestion?.type]);



    async function handleClick() {
        if (!survey) return;

        const missing = survey.questions.filter(q => {
            if (q.type === "label") return false;
            if (q.optional) return false;
            if (q.type === "sortRank") {
                const val = answers[q.id];
                return !Array.isArray(val) || val.length !== (q.options?.length ?? 0);
            }
            return answers[q.id] == null || answers[q.id] === "";
        });

        if (missing.length > 0) {
            alert("Some required questions are missing.\n\nOn the review screen, look for items highlighted in yellow and sliders that still show a dash (—) instead of a number.");
            return;
        }

        try {
            await sendSurvey(roomCode, userId, { answers, conversationMarks });
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}_step`);
            localStorage.removeItem(`${storageKey}_marks`);
            socket.emit("survey-complete", { roomCode, userId });
            navigate("/exit", { state: { userId } });
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
        }
    }

    function handleNext() {
        if (isReflectionStep) {
            // basically requires 3 messages unless if it less than 9 change this to have you go back on review
            const requiredMarks = Math.min(3, Math.max(1, Math.floor(conversationMessages.length / 3)));
            const allMarksHaveNotes = conversationMarks.every(m => m.note && m.note.trim().length > 0);
            if (conversationMarks.length < requiredMarks || !allMarksHaveNotes) {
                alert(`Please mark at least ${requiredMarks} moments and add a note to each one.`);
                return;
            }
            setCurrentStep(1);
            return;
        }
        if (fromReview) {
            const currentDisplayIndex = currentStep - 1;
            let nextUnanswered = -1;
            for (let i = currentDisplayIndex + 1; i < displaySteps.length; i++) {
                if (displayStepHasUnanswered(displaySteps[i], answers)) {
                    nextUnanswered = i;
                    break;
                }
            }
            if (nextUnanswered >= 0) {
                setCurrentStep(nextUnanswered + 1);
            } else {
                setCurrentStep(displaySteps.length + 1);
                setFromReview(false);
            }
            return;
        }
        if (isReviewStep) {
            handleClick();
            return;
        }
        if (currentStep === displaySteps.length) {
            setCurrentStep(displaySteps.length + 1);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    }

    function handlePrev() {
        if (currentStep === 1) {
            setCurrentStep(0);
            return;
        }
        if (currentStep === displaySteps.length + 1) {
            setCurrentStep(displaySteps.length);
            return;
        }
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }

    function handleEdit(index) {
        setCurrentStep(index + 1);
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
    const isLastQuestion = currentStep === displaySteps.length && !isReviewStep;
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
                    {isReflectionStep
                        ? `Reflection (1 of ${totalSteps})`
                        : isReviewStep
                            ? `Review (${currentStep + 1} of ${totalSteps})`
                            : `Question ${currentStep + 1} of ${totalSteps}`}
                </span>
            </div>

            {!isReflectionStep && (
                <div className="conversation-btn-wrapper">
                    <button
                        className="conversation-history-btn"
                        onClick={() => setShowConversation(true)}
                    >
                        Conversation History
                    </button>
                </div>
            )}

            <div className="survey-card">
                {/* {!isReflectionStep && (
                    <div className="room-top-left">
                        <button
                            className="info-icon-button"
                            title="View conversation history"
                            aria-label="View conversation history"
                            onClick={() => setShowConversation(true)}
                        >
                            i
                        </button>
                    </div>
                )} */}

                {!isReflectionStep && (
                    user ? (
                        <p className="survey-intro">
                            {user.userName}, please complete the following survey of your experience from room {user.roomCode}.
                        </p>
                    ) : (
                        <p>User info is loading...</p>
                    )
                )}

                {isReflectionStep ? (
                    <ConversationReflectionStep
                        messages={conversationMessages}
                        marks={conversationMarks}
                        onMarksChange={setConversationMarks}
                    />
                ) : isReviewStep ? (
                    <div className="survey-review">
                        <h3 className="survey-review-title">Review your answers</h3>
                        <p className="survey-review-subtitle">You can edit any response before submitting.</p>
                        <ul className="survey-review-list">
                            {displaySteps.flatMap((step, stepIndex) => {
                                const questionsInStep = step.questions ?? (step.question ? [step.question] : []);
                                return questionsInStep.map((q) => {
                                    const isUnanswered = isRequiredQuestionUnanswered(q, answers);
                                    return (
                                        <li
                                            key={q.id}
                                            className={`survey-review-item ${isUnanswered ? "survey-review-item--unanswered" : ""}`}
                                        >
                                            <div className="survey-review-item-content">
                                                <span className="survey-review-question">{q.label}</span>
                                                <span className={`survey-review-answer ${isUnanswered ? "survey-review-answer--empty" : ""}`}>
                                                    {formatAnswer(q, answers)}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className={isUnanswered ? "survey-review-edit-btn survey-review-edit-btn--answer" : "survey-review-edit-btn"}
                                                onClick={() => handleEdit(stepIndex)}
                                            >
                                                {isUnanswered ? "Answer" : "Edit"}
                                            </button>
                                        </li>
                                    );
                                });
                            })}
                        </ul>
                    </div>
                ) : currentDisplayStep ? (
                    <div
                        key={
                            currentQuestions.map(q => q.id || q.label).join("|") ||
                            primaryQuestion?.id ||
                            primaryQuestion?.label
                        }
                        className="survey-question-step"
                    >
                        {currentDisplayStep.sectionLabel && (
                            <p className="survey-section-label">{currentDisplayStep.sectionLabel.label}</p>
                        )}
                        {currentQuestions.map((q) => (
                            <div key={q.id || q.label} className="survey-question-block">
                                <p className="survey-question-label">
                                    {q.label}
                                    {q.optional ? " (optional)" : ""}
                                </p>

                                {q.type === "select" && (
                                    <div className="form-group">
                                        <select
                                            value={answers[q.id] ?? ""}
                                            onChange={(e) => setAnswers(prev => ({
                                                ...prev, [q.id]: e.target.value
                                            }))}
                                        >
                                            <option value="">Select...</option>
                                            {q.options.map(o => (
                                                <option key={o} value={o}>{o}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {q.type === "text" && (
                                    <div className="form-group">
                                        {q.id === "age" ? (
                                            <div className="age-input">
                                                <button
                                                    type="button"
                                                    className="age-input-btn"
                                                    aria-label="Decrease age"
                                                    onClick={() => {
                                                        const raw = answers[q.id];
                                                        const parsed = parseInt(raw, 10);
                                                        const base = Number.isNaN(parsed) ? 1 : parsed;
                                                        const next = Math.max(1, base - 1);
                                                        setAnswers(prev => ({
                                                            ...prev,
                                                            [q.id]: String(next)
                                                        }));
                                                    }}
                                                >
                                                    −
                                                </button>
                                                <input
                                                    className="age-input-field"
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={1}
                                                    max={120}
                                                    step={1}
                                                    value={answers[q.id] ?? ""}
                                                    onChange={(e) => setAnswers(prev => ({
                                                        ...prev,
                                                        [q.id]: e.target.value
                                                    }))}
                                                    placeholder={q.placeholder || "e.g., 24"}
                                                />
                                                <button
                                                    type="button"
                                                    className="age-input-btn"
                                                    aria-label="Increase age"
                                                    onClick={() => {
                                                        const raw = answers[q.id];
                                                        const parsed = parseInt(raw, 10);
                                                        const base = Number.isNaN(parsed) ? 1 : parsed;
                                                        const next = Math.min(120, base + 1);
                                                        setAnswers(prev => ({
                                                            ...prev,
                                                            [q.id]: String(next)
                                                        }));
                                                    }}
                                                >
                                                    +
                                                </button>
                                                <span className="age-input-suffix">years</span>
                                            </div>
                                        ) : (
                                            <textarea
                                                rows={6}
                                                value={answers[q.id] ?? ""}
                                                onChange={(e) => setAnswers(prev => ({
                                                    ...prev, [q.id]: e.target.value
                                                }))}
                                                placeholder={q.placeholder || "Type your response here..."}
                                            />
                                        )}
                                    </div>
                                )}

                                {q.type === "scale" && q.style === "slider" && (
                                    <div
                                        className={`scale-wrapper ${
                                            answers[q.id] == null || answers[q.id] === "" ? "unanswered" : ""
                                        }`}
                                    >
                                        <input
                                            type="range"
                                            min={q.min}
                                            max={q.max}
                                            step={q.step}
                                            value={answers[q.id] ?? q.min}
                                            onChange={(e) => setAnswers(prev => ({
                                                ...prev, [q.id]: Number(e.target.value)
                                            }))}
                                            onClick={(e) => {
                                                if (answers[q.id] == null || answers[q.id] === "") {
                                                    setAnswers(prev => ({
                                                        ...prev, [q.id]: Number(e.target.value)
                                                    }));
                                                }
                                            }}
                                        />
                                        <div className="scale-labels">
                                            <span className="left-label">{q.leftLabel}</span>
                                            <span className="selected-number">
                                                {answers[q.id] == null || answers[q.id] === "" ? "—" : answers[q.id]}
                                            </span>
                                            <span className="right-label">{q.rightLabel}</span>
                                        </div>
                                    </div>
                                )}

                                {q.type === "sortRank" && (() => {
                                    const sortOptions = answers[q.id] ?? q.options ?? [];
                                    return (
                                        <div className="sort-rank-wrapper">
                                            <p className="sort-rank-hint">Drag to reorder from what you cared about most (top) to least (bottom). Your top 3 matter most.</p>
                                            <SortRankList
                                                questionId={q.id}
                                                options={sortOptions}
                                                onOrderChange={(nextOptions) =>
                                                    setAnswers((prev) => ({ ...prev, [q.id]: nextOptions }))
                                                }
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                ) : null}

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
                                ? "Next unanswered question"
                                : isReflectionStep
                                    ? "Continue"
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
