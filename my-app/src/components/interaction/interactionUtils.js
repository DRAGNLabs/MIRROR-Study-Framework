
import { getUser, getUserRole } from "../../services/usersService";   
import games from "../gameLoader"; 
    
export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};


export async function loadRoomState(isAdmin, roomCode, user=null, isStreamingRef) {
    try {
        const room = await getRoom(roomCode);
        // stuff below only for user:
        // return role and gameData and set it in user
        let gameData;
        let userRole;
        if (!isAdmin && user) {
            gameData = games.find(g => parseInt(g.id) === room.gameType);
            const { role } = await getUserRole(user.userId);
            userRole = role;
        }
        // setUserRole(gameData.roles[parseInt(role) - 1]);
        // setGame(gameData);

        const llmInstructions = room.llmInstructions ?? {};
        const userMessages = room.userMessages ?? {};
        const llmResponse = room.llmResponse ?? {};
        const numRounds = room.numRounds ?? 1;
        const fish_amount = room.fish_amount ?? {};

        const { messages, canSend, hasSentThisRound } = await resetMessages(
            llmInstructions,
            userMessages,
            llmResponse,
            numRounds,
            fish_amount
        );

        // Parse resourceAllocations history if present on the room.
        let resourceHistory = []
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
                resourceHistory = history;
                // setResourceHistory(history);
            } catch (err) {
                console.error("Error parsing resourceAllocations:", err);
                resourceHistory = [];
                // setResourceHistory([]);
            }
        } else {
            resourceHistory = [];
            // setResourceHistory([]);
        }

        if (isStreamingRef.current) {
            return;
        }
        // could return messages, canSend, hasSentThisRound
        if (isAdmin) {
            return {
                messages: messages,
                resourceHistory: resourceHistory
            }
        } else {
            return {
                messages: messages,
                resourceHistory: resourceHistory,
                canSend: canSend, 
                hasSentThisRound: hasSentThisRound,
                game: gameData,
                userRole: role
            }
        }
        // setMessages(messages);
        // setCanSend(canSend);
        // setHasSentThisRound(hasSentThisRound);
    } catch (err) {
        console.error("Failed to load room state:", err);
    } 
    // finally {
    //     // do I need this (only on user side)
    //     // setLoading(false);
    // }
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

async function resetMessages(llmInstructions, userMessages, llmResponse, numRounds, fish_amount) {
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
            if (llmResponse[round] || loadCurrUserMessages.current) {
                newMsgs.push({
                    sender: "user", 
                    id: msgUserId, 
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
                id: `llm-${round}`,
                text: llmResponse[round]
            });
        }
        if (parseInt(round) === parseInt(numRounds) && llmResponse[round]) {
            newMsgs.push({
                sender: "user",
                id: "admin-end",
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