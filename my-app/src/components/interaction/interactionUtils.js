
import { getUser, getUserRole} from "../../services/usersService";  
import { getRoom } from "../../services/roomsService"; 
import games from "../../gameLoader"; 
    
export async function loadRoomState(
    isAdmin,
    roomCode,
    user=null,
    isStreamingRef,
    loadCurrUserMessages,
    setMessages,
    setResourceHistory,
    setSentMessages,
    setCanSend=null,
    setHasSentThisRound=null,
    setGame=null,
    setUserRole=null,
    setStatusHistory=null,
) {
    try {
        const room = await getRoom(roomCode);
        const practiceData = room.practiceData ?? {};
        // Practice results (allocations, status) only show until the real game
        // starts — none of it carries over into the real game.
        const inPracticePhase = !!room.practice && !practiceData.officialStarted;
        if (!isAdmin && user) {
            const gameData = games.find(g => parseInt(g.id) === room.gameType);
            const { role } = await getUserRole(user.userId);
            setUserRole(fillRoleTons(gameData.roles[parseInt(role) - 1], room.tons_needed));
            setGame(gameData);

            if (setStatusHistory && gameData?.role_prompt) {
                const fullUser = await getUser(user.userId);
                const history = buildStatusHistory(fullUser, gameData, room.curr_round);
                const practiceStatus = practiceData.statusByUserId?.[user.userId];
                if (inPracticePhase && practiceStatus?.message) {
                    history.unshift({ round: 0, isPractice: true, ...practiceStatus });
                }
                setStatusHistory(history);
            }
        }

        const llmInstructions = room.llmInstructions ?? {};
        const userMessages = room.userMessages ?? {};
        const llmResponse = room.llmResponse ?? {};
        const numRounds = room.numRounds ?? 1;
        const fish_amount = room.fish_amount ?? {};
        const practiceInProgress = practiceData.status === "in_progress";

        const currentRound = room.curr_round;
        const currentRoundMessages = practiceInProgress
            ? (practiceData.messages ?? [])
            : (userMessages[currentRound] || []);
        setSentMessages(currentRoundMessages.length);




        const { messages, canSend, hasSentThisRound } = await resetMessages(
            llmInstructions,
            userMessages,
            llmResponse,
            numRounds,
            fish_amount,
            user?.userId,
            loadCurrUserMessages?.current
        );

        // Parse resourceAllocations history if present on the room.
        if (room.resourceAllocations) {
            try {
                const parsed = room.resourceAllocations ?? {};

                const history = Object.keys(parsed)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((roundKey) => {
                        const roundNumber = Number(roundKey);
                        const entry = parsed[roundKey] || {};
                        const allocationByUserName = entry.allocationByUserName || {};
                        return {
                            round: roundNumber,
                            allocations: allocationByUserName
                        };
                    });
                if (inPracticePhase && practiceData.allocations && Object.keys(practiceData.allocations).length > 0) {
                    history.unshift({
                        round: 0,
                        isPractice: true,
                        allocations: practiceData.allocations
                    });
                }
                setResourceHistory(history);
            } catch (err) {
                console.error("Error parsing resourceAllocations:", err);
                setResourceHistory([]);
            }
        } else {
            setResourceHistory([]);
        }

        if (isStreamingRef.current) {
            return;
        }
        const practiceMessages = [];
        if (practiceData.instructions && !practiceData.officialStarted) {
            practiceMessages.push({
                sender: "llm",
                id: "practice-instructions",
                text: practiceData.instructions
            });
            for (const [messageUserId, text] of practiceData.messages ?? []) {
                const messageUser = await getUserName(messageUserId);
                practiceMessages.push({
                    sender: "user",
                    id: `${messageUserId}-0`,
                    userName: messageUser.userName,
                    text
                });
            }
            if (practiceData.response) {
                practiceMessages.push({
                    sender: "llm",
                    id: "practice-response",
                    text: practiceData.response
                });
            }
            // matches PRACTICE_FINISHED_MESSAGE in backend/socket/gameHandler.js
            if (practiceData.status === "complete") {
                practiceMessages.push({
                    sender: "user",
                    userName: "Admin",
                    id: "practice-finished",
                    text: "Practice round finished. The real game will start shortly."
                });
            }
        }

        setMessages([...practiceMessages, ...messages]);
        if(!isAdmin) {
            if (practiceInProgress) {
                const sentPracticeMessage = (practiceData.messages ?? [])
                    .some(([messageUserId]) => messageUserId === user.userId);
                setCanSend(!!practiceData.instructions && !sentPracticeMessage);
                setHasSentThisRound(sentPracticeMessage);
            } else {
                setCanSend(canSend);
                setHasSentThisRound(hasSentThisRound);
            }
        }
    } catch (err) {
        console.error("Failed to load room state:", err);
    } 
}

export function fillRoleText(template, userName, tons) {
    if (typeof template !== "string") return "";
    return template
        .replace(/\{\{user_name\}\}/g, userName ?? "")
        .replace(/\{\{tons\}\}/g, tons ?? "");
}
export function fillRoleTons(role, tons) {
    if (!role) return role;
    return { ...role, backstory: fillRoleText(role.backstory, "", tons) };
}


export function buildStatusHistory(fullUser, game, currentRound) {
    const rolePrompts = game?.role_prompt?.[fullUser?.role];
    const userStatus = fullUser?.user_status;
    if (!rolePrompts || !userStatus) return [];

    const history = [];
    for (let i = 2; i <= currentRound; i++) {
        if (userStatus[i] == null || userStatus[i - 1] == null) continue;
        const status = userStatus[i];
        const prev_status = userStatus[i - 1];
        if (status === prev_status) continue;

        const isExit =
            (prev_status < status && prev_status < 0) ||
            (prev_status > status && prev_status > 0);
        const promptSet = rolePrompts[isExit ? prev_status : status];
        if (!promptSet) continue;

        const kind = isExit ? "exit" : "enter";
        history.push({
            round: i,
            status,
            kind,
            good: status > prev_status,
            message: fillRoleText(promptSet[kind], fullUser.userName)
        });
    }
    return history;
}

async function getUserName(id) {
    try {
        const user = await getUser(id);
        return user;
    } catch (error) {
        console.error("Error fetching user:", error);
        return { userName: "Unknown" };
    }
}

async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds, fish_amount, userId = null, loadCurrUserMessages = false) {
    const newMsgs = [];
    let lastRound = -1;
    let userSentThisRound = false;
    let llmResponded = false;

    const rounds = Object.keys(llmInstructions || {}).sort((a,b) => Number(a) - Number(b));
    for (const round of rounds) {
        userSentThisRound = false;
        llmResponded = false;
        lastRound = round;

        if (llmInstructions[round]) {
            newMsgs.push({
                sender: "llm", 
                id: `llm-instructions-${round}`,
                text: llmInstructions[round]
            });
        }
        const msgs = Array.isArray(userMessages[round]) ? userMessages[round] : [];
        for (const [msgUserId, text] of msgs) {
            const userTemp = await getUserName(msgUserId);
            if (llmResponse[round] || loadCurrUserMessages) {
                newMsgs.push({
                    sender: "user", 
                    id: `${msgUserId}-${round}`, 
                    userName: userTemp.userName, 
                    text: text
                });
            }
            if (userId === msgUserId) {
                userSentThisRound = true;
            }
        }
        if (llmResponse[round]) {
            llmResponded = true;
            newMsgs.push({
                sender: "llm",
                id: `llm-response-${round}`,
                text: llmResponse[round]
            });
        }
        if (parseInt(round) === parseInt(numRounds) && llmResponse[round]) {
            newMsgs.push({
                sender: "user",
                id: "game-ended",
                userName: "Admin",
                text: "All rounds are complete, game is ended.",
            });
        }
        if(fish_amount[parseInt(round)+1] < 5) {
            newMsgs.push({ 
                sender: "user", 
                userName: "Admin",
                id: "no-fish-left",
                text: "Fish got below 5 tons, no more fish left to allocate game is over", 
                
            });
        }
        
    }
    return {
        messages: newMsgs,
        canSend: !!llmInstructions[lastRound] && !userSentThisRound && !llmResponded,
        hasSentThisRound: userSentThisRound
    };
}


export const startClientTimer = (endTime, timerIntervalRef, setTimeRemaining) => {
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

export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
    // async function refreshResourceAllocations() {
    //     try {
    //         const room = await getRoom(roomCode);
    //         if (room.resourceAllocations) {
    //             const parsed = room.resourceAllocations ?? {};
    //             const history = Object.keys(parsed)
    //                 .sort((a, b) => Number(a) - Number(b))
    //                 .map((roundKey) => {
    //                     const roundNumber = Number(roundKey);
    //                     const entry = parsed[roundKey] || {};
    //                     const allocationByUserName = entry.allocationByUserName || {};
    //                     return { round: roundNumber, allocations: allocationByUserName };
    //                 });
    //             setResourceHistory(history);
    //         }
    //     } catch (err) {
    //         console.error("Failed to refresh resource allocations:", err);
    //     }
    // }
