/** This page is where the user will take the survey */

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from '../../services/usersService';
import { sendSurvey  } from "../../services/surveyService";
import { getRoom } from "../../services/roomsService"
import { socket } from '../socket';
import games from "../gameLoader";
import ConversationModal from "./ConversationModal";
import ConversationReflectionStep from "./ConversationReflectionStep";

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
    if (q.type === "sortRank" && Array.isArray(val)) {
        return val.map((opt, i) => `${i + 1}. ${opt}`).join(", ");
    }
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
    const [conversationMarks, setConversationMarks] = useState([]);

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

    // Initialize sortRank answer to option order when first viewing the question
    useEffect(() => {
        if (!currentQuestion || currentQuestion.type !== "sortRank" || !currentQuestion.options?.length) return;
        const current = answers[currentQuestion.id];
        if (Array.isArray(current) && current.length === currentQuestion.options.length) return;
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: [...(currentQuestion.options)]
        }));
    }, [currentQuestion?.id, currentQuestion?.type]);

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
            alert("Please fill out all survey questions before submitting!");
            return;
        }

        try {
            await sendSurvey(1, userId, { answers, conversationMarks });
            socket.emit("survey-complete", { roomCode, userId, surveyId });
            navigate("/exit", { state: { userId } });
        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
        }
    }

    function handleNext() {
        if (isReflectionStep) {
            setCurrentStep(1);
            return;
        }
        if (fromReview) {
            setCurrentStep(displaySteps.length + 1);
            setFromReview(false);
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

    const [sortRankDraggingIndex, setSortRankDraggingIndex] = useState(null);
    const [sortRankDropTargetIndex, setSortRankDropTargetIndex] = useState(null);
    const sortRankDragSourceRef = useRef(null);
    const sortRankListRef = useRef(null);
    const sortRankFlipRef = useRef(null);

    /** Move one item from fromIndex to toIndex; other items shift. Returns new array. */
    function moveItemInArray(arr, fromIndex, toIndex) {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length || toIndex >= arr.length) {
            return arr;
        }
        const copy = [...arr];
        const [removed] = copy.splice(fromIndex, 1);
        const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
        copy.splice(insertAt, 0, removed);
        return copy;
    }

    function handleSortRankDragStart(e, index) {
        sortRankDragSourceRef.current = index;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        setSortRankDraggingIndex(index);
    }

    function handleSortRankDragOver(e, toIndex) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setSortRankDropTargetIndex(prev => (prev === toIndex ? prev : toIndex));
    }

    function handleSortRankDrop(e, toIndex) {
        e.preventDefault();
        e.stopPropagation();
        const fromIndex = sortRankDragSourceRef.current ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
        const questionId = currentQuestion?.id;
        const options = answers[questionId];

        setSortRankDraggingIndex(null);
        setSortRankDropTargetIndex(null);
        sortRankDragSourceRef.current = null;

        if (!Array.isArray(options) || Number.isNaN(fromIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= options.length || toIndex >= options.length) {
            return;
        }

        const nextOptions = moveItemInArray(options, fromIndex, toIndex);
        if (nextOptions === options) return;

        const listEl = sortRankListRef.current;
        if (listEl) {
            const items = listEl.querySelectorAll(".sort-rank-item");
            const rects = Array.from(items).map(el => el.getBoundingClientRect());
            sortRankFlipRef.current = { order: [...options], rects };
        }

        setAnswers(prev => ({ ...prev, [questionId]: nextOptions }));
    }

    function handleSortRankDragEnd() {
        setSortRankDraggingIndex(null);
        setSortRankDropTargetIndex(null);
        sortRankDragSourceRef.current = null;
    }

    useEffect(() => {
        const flip = sortRankFlipRef.current;
        const questionId = currentQuestion?.id;
        const newOrder = questionId && currentQuestion?.type === "sortRank" ? (answers[questionId] ?? []) : null;

        if (!flip || !newOrder?.length || !sortRankListRef.current || flip.order.length !== newOrder.length) {
            return;
        }
        const orderChanged = flip.order.some((opt, i) => opt !== newOrder[i]);
        if (!orderChanged) {
            sortRankFlipRef.current = null;
            return;
        }

        const listEl = sortRankListRef.current;
        const items = listEl.querySelectorAll(".sort-rank-item");
        if (items.length !== newOrder.length) {
            sortRankFlipRef.current = null;
            return;
        }

        const newRects = Array.from(items).map(el => el.getBoundingClientRect());

        items.forEach((el, i) => {
            const option = newOrder[i];
            const oldIndex = flip.order.indexOf(option);
            if (oldIndex === -1) return;
            const oldRect = flip.rects[oldIndex];
            const newRect = newRects[i];
            const deltaY = oldRect.top - newRect.top;
            el.style.transition = "none";
            el.style.transform = `translateY(${deltaY}px)`;
        });

        sortRankFlipRef.current = null;

        const startAnimation = () => {
            requestAnimationFrame(() => {
                items.forEach(el => {
                    el.style.transition = "transform 0.28s ease-out";
                    el.style.transform = "";
                });
            });
        };
        const rafId = requestAnimationFrame(startAnimation);
        return () => cancelAnimationFrame(rafId);
    }, [answers[currentQuestion?.id], currentQuestion?.id, currentQuestion?.type]);

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
                            {displaySteps.map((step, index) => {
                                const q = step.question;
                                const isRequired = !q.optional;
                                const isUnanswered = isRequired && (q.type === "sortRank"
                                    ? !Array.isArray(answers[q.id]) || answers[q.id].length !== (q.options?.length ?? 0)
                                    : (answers[q.id] == null || answers[q.id] === ""));
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
                ) : currentDisplayStep ? (
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

                        {currentQuestion.type === "sortRank" && (() => {
                            const sortOptions = answers[currentQuestion.id] ?? currentQuestion.options ?? [];
                            return (
                                <div className="sort-rank-wrapper">
                                    <p className="sort-rank-hint">Drag to reorder from what you cared about most (top) to least (bottom). Your top 3 matter most.</p>
                                    <ul className="sort-rank-list" ref={sortRankListRef}>
                                        {sortOptions.map((option, index) => {
                                            const isGreyed = index >= 3;
                                            const isDragging = sortRankDraggingIndex === index;
                                            const showDropIndicator = sortRankDropTargetIndex === index;
                                            return (
                                                <Fragment key={`${option}-${index}`}>
                                                    {showDropIndicator && (
                                                        <li
                                                            className="sort-rank-drop-indicator"
                                                            aria-hidden
                                                            onDragOver={(e) => handleSortRankDragOver(e, index)}
                                                            onDrop={(e) => handleSortRankDrop(e, index)}
                                                        />
                                                    )}
                                                    <li
                                                        className={`sort-rank-item ${isGreyed ? "sort-rank-item--greyed" : ""} ${isDragging ? "sort-rank-item--dragging" : ""}`}
                                                        draggable
                                                        onDragStart={(e) => handleSortRankDragStart(e, index)}
                                                        onDragOver={(e) => handleSortRankDragOver(e, index)}
                                                        onDrop={(e) => handleSortRankDrop(e, index)}
                                                        onDragEnd={handleSortRankDragEnd}
                                                    >
                                                        <span className="sort-rank-item-drag-handle" aria-hidden>::</span>
                                                        <span className="sort-rank-item-label">
                                                            {index + 1}. {option}
                                                        </span>
                                                    </li>
                                                </Fragment>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })()}
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
                                ? "Back to Review"
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
