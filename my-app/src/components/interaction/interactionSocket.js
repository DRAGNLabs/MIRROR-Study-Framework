import { useEffect, useRef, useState } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
import { socket } from '../../socket'
import { socketListener } from "../common/socketListener";
import { loadRoomState } from "./interactionUtils";

/*
stuff I need to import:
loadRoomState()
startClientTimer()
handleRoundComplete()


setTimeout ? where is this from
RESPONSE_TIMEOUT where is this from?
*/
export function useInteractionSocket(roomCode, isAdmin, user = null, setMessages, setTimeRemaining, loadRoomState, adminHandlers={}) {

    // const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState("");
    const [currentStreamingId, setCurrentStreamingId] = useState(null);
    const [canSend, setCanSend] = useState(false);
    const [hasSentThisRound, setHasSentThisRound] = useState(false);

    const isStreamingRef = useRef(false);
    const timerIntervalRef = useRef(null);
    const loadCurrUserMessages = useRef();

    // basic socketListener
    socketListener(roomCode, isAdmin, user);

    useEffect(() => {
        socket.on("receiv-message", (message) => {
            setMessages((prev) => [...prev, message]); 
        });

        socket.on("all-user-messages", ({ round, messages }) => {
            loadCurrUserMessages.current = true;
            setMessages((prev) => [...prev, ...messages]);
        });

        socket.on("ai-start", () => {
            isStreamingRef.current = true;
            const newId = Date.now();
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

        socket.on("ai-end", async () => {
            isStreamingRef.current = false;
            setCurrentStreamingId(null);
            setStreamingText("");

            // in admin I feel like this could cause errors (if socket is disconnected on admin)
            if(isAdmin) {
                // adminHandlers.onAIEnd();
                setTimeout(() => {
                    handleRoundComplete();
                }, RESPONSE_TIMEOUT);
            }
        });

        socket.on("round-complete", (round) => {
            // users
            if (!isAdmin) {
                setCanSend(false);
                setHasSentThisRound(true);
            }
            // both
            setTimeRemaining(null); 
            loadCurrUserMessages.current = false;
            if (timerIntervalRef.current) { 
                clearInterval(timerIntervalRef.current);
            }
            // Refresh to pull in updated llmResponse and resourceAllocations.
            loadRoomState(isAdmin, roomCode, user, isStreamingRef);
        });

        // only in users
        // diff between users/admin, game-complete, timer-expired, round-complete, ai-end
        if (!isAdmin) {
            socket.on("game-complete", ()=> {
                setCanSend(false);
                setHasSentThisRound(true);
                loadCurrUserMessages.current = false;
                // Final refresh so last-round allocations are visible.
                loadRoomState(isAdmin, roomCode, user, isStreamingRef);
            });

            socket.on("instructions-complete", (round) => {
                setCanSend(true);
                setHasSentThisRound(false);
            })
        }

        socket.on("timer-start", ({ duration, endTime }) => {
            console.log(`Timer started: ${duration}ms`);
            startClientTimer(endTime);
        });

        socket.on("timer-expired", () => {
            console.log("Timer expired");
            setTimeRemaining(null);
            // can send only in users
            if (!isAdmin) {
                setCanSend(false);
            }
            // need to import clearInterval from separate file
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        });

        return () => {
            socket.off("receive-message");
            socket.off("all-user-messages");
            socket.off("room-users");
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("round-complete");
            if (!isAdmin) {
                socket.off("game-complete"); // in users
                socket.off("instructions-complete");
            }
            // socket.off("force-return-to-login");
            // socket.off("status");
            socket.off("timer-start");
            socket.off("timer-expired");
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    }, [socket, isAdmin, setMessages, setTimeRemaining, loadRoomState, adminHandlers]);


    useEffect(() => {
        loadRoomState(isAdmin, roomCode, user, isStreamingRef);
    }, [roomCode]);

    // i don't know how to put this seperately
    useEffect(() => {
        if (!streamingText) return;

        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === currentStreamingId ? { ...msg, text: streamingText } : msg
            )
        );
    }, [streamingText, currentStreamingId, setMessages]);

    const startClientTimer = (endTime) => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
    }

    const updateTimer = () => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                clearInterval(timerIntervalRef.current);
            }
        };

        updateTimer();
        timerIntervalRef.current = setInterval(updateTimer, 1000);
    }



    if (isAdmin) {
        return {
            streamingText,
            currentStreamingId,
            isStreamingRef,
            timerIntervalRef,
            loadCurrUserMessages 
        }
    } else {
        return {
            streamingText,
            currentStreamingId,
            canSend,
            hasSentThisRound,
            isStreamingRef,
            timerIntervalRef,
            loadCurrUserMessages
        }
    }
}