import { useEffect, useCallback } from "react";
import { socket } from '../../socket'
import { socketListener } from "../common/socketListener";
import { loadRoomState, startClientTimer } from "./interactionUtils";


export function useInteractionSocket(
    roomCode, 
    isAdmin, 
    user = null, 
    isStreamingRef,
    timerIntervalRef,
    loadCurrUserMessages,
    setMessages, 
    setResourceHistory,
    setTimeRemaining,
    setStreamingText,
    setCurrentStreamingId,
    setCanSend = null,
    setHasSentThisRound = null,
    setGame=null,
    setUserRole=null
) {


    // basic socketListener
    socketListener(roomCode, isAdmin, user);

    const refreshRoomState = useCallback(() => {
        loadRoomState(
            isAdmin, 
            roomCode, 
            user, 
            isStreamingRef, 
            loadCurrUserMessages,
            setMessages, 
            setResourceHistory, 
            setCanSend, 
            setHasSentThisRound, 
            setGame, 
            setUserRole
        );
    }, [isAdmin, roomCode, user, isStreamingRef, loadCurrUserMessages, setMessages, setResourceHistory, setCanSend, setHasSentThisRound, setGame, setUserRole]);

    useEffect(() => {
        refreshRoomState();
    }, [refreshRoomState]);

    useEffect(() => {
        socket.on("receive-message", (message) => {
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
            refreshRoomState();
        });

        if (!isAdmin) {
            socket.on("game-complete", ()=> {
                setCanSend(false);
                setHasSentThisRound(true);
                loadCurrUserMessages.current = false;
                // refreshRoomState();
                // Final refresh so last-round allocations are visible.
                refreshRoomState();
            });

            socket.on("instructions-complete", (round) => {
                setCanSend(true);
                setHasSentThisRound(false);
                // refreshRoomState();
            })
        }

        socket.on("timer-start", ({ duration, endTime }) => {
            console.log(`Timer started: ${duration}ms`);
            startClientTimer(endTime, timerIntervalRef, setTimeRemaining);
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
            socket.off("ai-token");
            socket.off("ai-start");
            socket.off("ai-end");
            socket.off("round-complete");
            if (!isAdmin) {
                socket.off("game-complete"); // in users
                socket.off("instructions-complete");
            }
            socket.off("timer-start");
            socket.off("timer-expired");
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    }, [isAdmin, refreshRoomState, isStreamingRef, timerIntervalRef, loadCurrUserMessages, setMessages, setTimeRemaining, setStreamingText, setCurrentStreamingId, setCanSend, setHasSentThisRound]);

}