import { loadGames } from "../services/gameLoader.js"
import { streamLLM, callLLM } from "../llm.js";
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, getSurveyStatus, roomCompleted, updateResourceAllocations, updateFishAmount, updateCurrRound, updatePracticeData, appendPracticeMessage } from "../services/roomsService.js";
import { getUser, updateUserStatus } from "../services/usersService.js"
import { jsonrepair } from "jsonrepair";

const games = loadGames();
const roundTimers = {}; // maybe make this rely on database?

const roundsFinalizing = new Set(); // roomCode currently running getLlmResponse
const instructionsInFlight = new Set(); // `${roomCode}:${round}` currently running getLlmInstructions
const practiceRoundStarting = new Set();
const practiceRoundsFinalizing = new Set();
const officialGameStarting = new Set();

const PRACTICE_FINISHED_MESSAGE = {
    sender: "user",
    userName: "Admin",
    text: "Practice round finished. The real game will start shortly.",
    id: "practice-finished"
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stripFences(text) {
    if (typeof text !== "string") return "";
    return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

function fillPrompt(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

// A user's status goes up one if they got at least tons_needed, otherwise down one.
// Moving further from 0 (either direction) is an "enter" into the new status;
// moving back toward 0 is an "exit" from the status being left, so its message is
// keyed by the old status. message is null if the game has no text for that status.
function getStatusChange(game, user, name, allocation, tonsNeeded, prev_status) {
    const good = allocation >= tonsNeeded;
    const status = good ? prev_status + 1 : prev_status - 1;
    const isExit =
        (prev_status < status && prev_status < 0) ||
        (prev_status > status && prev_status > 0);
    const kind = isExit ? "exit" : "enter";
    const promptSet = game.role_prompt?.[user?.role]?.[isExit ? prev_status : status];
    return {
        status,
        kind,
        good,
        message: promptSet ? fillPrompt(promptSet[kind], { user_name: name }) : null
    };
}

// Add this near the top of gameHandler.js
async function getRoomSafely(roomCode) {
    try {
        const room = await getRoom(roomCode);
        return room;
    } catch (error) {
        // Room was deleted or doesn't exist
        console.log(`Room ${roomCode} no longer exists, cleaning up...`);
        deleteTimer(roomCode);
        return null;
    }
}

// used in start-round socket and getLlmResponse function
async function getLlmText(io, roomCode, getInstructions, getAllocation, { practice = false } = {}) {
    const room = await getRoomSafely(roomCode);
    if(!room) {
        deleteTimer(roomCode);
        return null;
    }
    // const room = await getRoom(roomCode);
    // if (!room) {
    //     deleteTimer(roomCode);
    //     return null;
    // }
    const round = practice ? 0 : room.curr_round;
    const game = games.find(g=> parseInt(g.id) === room.gameType);
    const systemPrompt = game.prompts[0].system_prompt;
    // might want to change the line below to be conditional if there is an instruction prompt (as some games we won't prompt LLM for instructions)
    const instructionsPrompt = game.prompts[0].instruction_prompt;
    const responsePrompt = game.prompts[0].response_prompt;
    const practiceData = room.practiceData ?? {};
    const llmInstructions = practice
        ? { 0: practiceData.instructions ?? "" }
        : (room.llmInstructions ?? {});
    const llmResponses = practice
        ? { 0: practiceData.response ?? "" }
        : (room.llmResponse ?? {});
    const userMessages = practice
        ? { 0: practiceData.messages ?? [] }
        : (room.userMessages ?? {});
    // the practice round plays with round 1's starting fish but never writes to fish_amount
    const fish_amount = practice
        ? { 0: room.fish_amount?.[1] ?? 100 }
        : (room.fish_amount ?? {});
    const allUserIds = room.userIds || [];

    const messages = [
        { "role": "system", "content": systemPrompt },
    ]

    for (let i = practice ? 0 : 1; i <= round; i++) {
        if (!game.instructions?.template) { // basically only puts instructions prompt in if we don't have a template in the file
            messages.push({ "role": "user", "content": instructionsPrompt})
            // messages.push({ "role": "user", "content": fillPrompt(instructionsPrompt, { curr_round: round, fish_available: fish_amount[i] }) })
        }
        if (!llmInstructions[i]) break;
        // messages.push({ "role": "assistant", "content": llmInstructions[i] });
        const roundMessages = userMessages[i] || [];

        let town_report = "";

        if (i > 1 && game.role_prompt) {
            const reports = await Promise.all(
                allUserIds.map(async (userId) => {
                    const user = await getUser(userId);
                    const name = user?.userName || `User ${userId}`;
                    const status = user.user_status?.[i] ?? 0;
                    const prev_status = user.user_status?.[i - 1] ?? 0;
                    const rolePrompts = game.role_prompt[user.role];
                    if (!rolePrompts) return "";

                    // Moving further from 0 (either direction) is an "enter" into
                    // the new, more extreme status; moving back toward 0 is an
                    // "exit" from the status being left, so it's keyed by the old
                    // status, not the new one.
                    const isExit =
                        (prev_status < status && prev_status < 0) ||
                        (prev_status > status && prev_status > 0);
                    const statusKey = isExit ? prev_status : status;
                    const promptSet = rolePrompts[statusKey];
                    const user_report = promptSet
                        ? fillPrompt(promptSet[isExit ? "llm_exit" : "llm_enter"], { user_name: name })
                        : "";

                    const lastAllocation = room.resourceAllocations?.[i - 1]?.allocationByUserName?.[name]?.fish ?? 0;
                    return `${name}: Last month you allocated ${lastAllocation} tons to ${name}. ${user_report}\n`;
                })
            );
            town_report = reports.join("");
        }

        // Messages in the order users submitted them (roundMessages is appended to
        // as each one comes in), then anyone who didn't respond this round.
        const respondedIds = roundMessages.map(([id]) => id);
        const noResponseIds = allUserIds.filter((userId) => !respondedIds.includes(userId));
        const formattedUserMessages = (
            await Promise.all([
                ...roundMessages.map(async ([userId, text]) => {
                    const user = await getUser(userId);
                    const name = user?.userName || `User ${userId}`;
                    return `${name}: ${text}`;
                }),
                ...noResponseIds.map(async (userId) => {
                    const user = await getUser(userId);
                    const name = user?.userName || `User ${userId}`;
                    return `${name}: [No response from this user]`;
                }),
            ])
        ).join("\n");

        // do we want to put in this user instructions everytime?
        messages.push({"role": "user", "content": `${fillPrompt(responsePrompt, { fish_available: fish_amount[i], month: practice ? "0 (practice round)" : i, town_report: town_report })} \n ${formattedUserMessages}` });
        if(!llmResponses[i]) break;
        messages.push({ "role": "assistant", "content": llmResponses[i] })
    }

    if(getInstructions) {
        await delay(500); // trying to circumvent concurrency issues
    }

    // console.log(`[Round ${round}] Sending ${messages.length} messages to LLM (getAllocation=${getAllocation})`);
    io.to(room.roomCode).emit("ai-start");

    console.log("messages: ", messages);
    let buffer = "";
    await streamLLM(messages, token => {
        buffer += token;
        io.to(room.roomCode).emit("ai-token", token); // allows tokens to be appended to LLM message as they come
    }, room.modelType);
    // lets interaciton and adminInteraciton know to reset everything since it has received the whole LLM message
    io.to(room.roomCode).emit("ai-end");

    if (!getAllocation) { // if you're just getting instructions we'll return the buffer
        return buffer;
    }

    // --- Call 2: Extract structured allocation data from natural response ---
    console.log(`[Round ${round}] Starting extraction call...`);
    try {
        const extractionPrompt = game.prompts[0].extraction_prompt;
        // Previously only the raw LLM response was sent, so the extractor had to guess round, fish available, names, and totals
        // const extractionMessages = [
        //     { role: "system", content: extractionPrompt },
        //     { role: "user", content: buffer },
        // ];

        // Exact names so the extractor doesn't have to guess keys from the prose
        const userNames = await Promise.all(
            (room.userIds || []).map(async (userId) => (await getUser(userId))?.userName || `User ${userId}`)
        );

        // Each user's total from earlier rounds, so totalFishSoFar doesn't have to be guessed
        const previousTotals = {};
        for (const [r, entry] of Object.entries(room.resourceAllocations ?? {})) {
            if (Number(r) >= round) continue;
            for (const [name, a] of Object.entries(entry?.allocationByUserName ?? {})) {
                previousTotals[name] = (previousTotals[name] || 0) + (Number(a?.fish) || 0);
            }
        }

        const extractionInput = {
            round,
            fish_available: fish_amount[round],
            userNames,
            previousTotalFishByUserName: previousTotals,
            llmResponse: buffer,
        };

        const extractionMessages = [
            { role: "system", content: extractionPrompt },
            { role: "user", content: JSON.stringify(extractionInput, null, 2) },
        ];

        let parsed;
        try {
            // we techinically don't need to pass modelType to callLLM, I've made it so callLLM uses a cheaper model in .env
            const raw = await callLLM(extractionMessages, room.modelType);
            const cleaned = stripFences(raw);
            parsed = JSON.parse(cleaned);
        } catch (err) {
            const raw = await callLLM(extractionMessages, room.modelType);
            const cleaned = stripFences(raw);
            const repaired = jsonrepair(cleaned);
            parsed = JSON.parse(repaired);
        }

        const allocationByUserName =
            parsed.allocationByUserName && typeof parsed.allocationByUserName === "object"
                ? parsed.allocationByUserName
                : {};

        // Previously fish_left came from the extractor's own fish_left field, which could disagree with allocationByUserName, I think this would've been the cause for 
        // const fish_left = typeof parsed.fish_left === "number" ? parsed.fish_left : fish_amount[round];
        const allocated = Object.values(allocationByUserName)
            .reduce((sum, a) => sum + (Number(a?.fish) || 0), 0);
        const fish_left = fish_amount[round] - allocated;

        // The practice round only ever writes to practiceData — never to fish_amount,
        // resourceAllocations, or users.user_status — so nothing from it carries
        // over into the real game. Everyone starts the practice round at status 0.
        if (practice) {
            const statusByUserId = {};
            if (game.role_prompt) {
                for (const userId of allUserIds) {
                    const user = await getUser(userId);
                    const name = user?.userName || `User ${userId}`;
                    const change = getStatusChange(game, user, name, allocationByUserName[name]?.fish ?? 0, room.tons_needed, 0);
                    statusByUserId[userId] = change;
                    if (change.message) {
                        io.to(`user-${userId}`).emit("status-update", { round: 0, isPractice: true, ...change });
                    }
                }
            }
            await updatePracticeData({
                allocations: allocationByUserName,
                fishLeft: fish_left,
                statusByUserId
            }, roomCode);
            console.log(`[Practice] Extraction succeeded, fish_left=${fish_left} (allocated=${allocated})`);
            return buffer;
        }

        if (fish_left < 5) {
            fish_amount[round + 1] = fish_left;
        } else if (fish_left > 50) {
            fish_amount[round + 1] = 100;
        } else {
            fish_amount[round + 1] = fish_left * 2;
        }
        await updateFishAmount(fish_amount, roomCode);

        if (game.role_prompt) {
            for (const userId of allUserIds) {
                const user = await getUser(userId);
                const name = user?.userName || `User ${userId}`;
                const prev_status = user.user_status?.[round] ?? 0;
                // tons_needed depends on how many players are in the room (set when they were seated)
                const change = getStatusChange(game, user, name, allocationByUserName[name]?.fish ?? 0, room.tons_needed, prev_status);

                const user_status = user.user_status ?? {};
                user_status[round + 1] = change.status;
                await updateUserStatus(userId, user_status);

                if (change.message) {
                    io.to(`user-${userId}`).emit("status-update", { round: round + 1, ...change });
                }
            }
        }

        // {1: 0, 2: 1}

        const existingResourceAllocations = room.resourceAllocations ?? {};
        existingResourceAllocations[round] = {
            allocationByUserName,
            assistantMessage: buffer
        };
        await updateResourceAllocations(existingResourceAllocations, roomCode);
        // console.log(`[Round ${round}] Extraction succeeded, fish_left=${typeof parsed.fish_left === "number" ? parsed.fish_left : "missing"}`);
        console.log(`[Round ${round}] Extraction succeeded, fish_left=${fish_left} (allocated=${allocated}), extractor fish_left=${typeof parsed.fish_left === "number" ? parsed.fish_left : "missing"}`);
    } catch (err) {
        console.error(`[Round ${round}] Extraction failed, continuing with natural response:`, err);
        if (!practice) {
            fish_amount[round + 1] = fish_amount[round];
            await updateFishAmount(fish_amount, roomCode);
        }
    }

    return buffer;
}




// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(io, roomCode) {
    if (roundsFinalizing.has(roomCode)) {
        console.log(`getLlmResponse already running for room ${roomCode}, skipping duplicate call`);
        return null;
    }
    roundsFinalizing.add(roomCode);
    try {
        if (roundTimers[roomCode]) {
            clearTimeout(roundTimers[roomCode].timeout);
            delete roundTimers[roomCode];
        }
        io.to(roomCode).emit("user-messages-complete");
        // const buffer = await getLlmText(io, roomCode, false, true);
        const room = await getRoomSafely(roomCode);
        if (room == null || room.status === "survey") {
            deleteTimer(roomCode);
            // console.log("In survey mode, skipping LLM response")
            return null;
        }
        const round = room.curr_round;
        let buffer;
        try {
            buffer = await getLlmText(io, roomCode, false, true);
        } catch (err) {
            console.error(`[Round ${round}] getLlmText crashed:`, err);
            io.to(roomCode).emit("ai-end");
            buffer = "An error occurred generating the response.";
        }

        try {
            const room = await getRoomSafely(roomCode);
            if (room == null) {
                deleteTimer(roomCode);
                return null;
            }
            const fish_amount = room.fish_amount ?? {};
            const llmResponses = room.llmResponse ?? {};
            llmResponses[round] = buffer;
            await updateLlmResponse(llmResponses, roomCode);

            const totalRounds = room.numRounds;
            if (round >= totalRounds) {
                if (room.practice) {
                    await updatePracticeData({ officialStarted: true, officialComplete: true }, roomCode);
                }
                io.to(roomCode).emit("game-complete");
                const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended.", id: "game-ended" };
                io.to(roomCode).emit("receive-message", endGameMsg);
                io.to(roomCode).emit("timer-expired");
                return;
            } else if (fish_amount[round+1] < 5) {
                if (room.practice) {
                    await updatePracticeData({ officialStarted: true, officialComplete: true }, roomCode);
                }
                // abort game if fish is below 5 tons
                const endGameMsg = { sender: "user", userName: "Admin", text: "Fish got below 5 tons, no more fish left to allocate game is over", id: "no-fish-left" };
                await delay(500);
                io.to(roomCode).emit("receive-message", endGameMsg);
                io.to(roomCode).emit("game-complete");
                io.to(roomCode).emit("timer-expired");
                return;
            } else {
                console.log(`Round ${round} completed, waiting for next round...`);
            }

            await updateCurrRound(round+1, roomCode);
            io.to(roomCode).emit("round-complete", round+1);
            await getLlmInstructions(io, roomCode, round+1);
        } catch (err) {
            console.error(`[Round ${round}] getLlmResponse post-processing crashed:`, err);
        }
    } finally {
        roundsFinalizing.delete(roomCode);
    }
}

export async function getLlmInstructions(io, roomCode, round) {
    const key = `${roomCode}:${round}`;
    if (instructionsInFlight.has(key)) {
        console.log(`getLlmInstructions already running for room ${roomCode} round ${round}, skipping duplicate call`);
        return null;
    }
    instructionsInFlight.add(key);
    try {
        return await getLlmInstructionsInner(io, roomCode, round);
    } finally {
        instructionsInFlight.delete(key);
    }
}

export async function practiceRoundInstructions(io, roomCode) {
    if (practiceRoundStarting.has(roomCode)) return null;
    practiceRoundStarting.add(roomCode);

    try {
        const room = await getRoomSafely(roomCode);
        if (!room || !room.practice || room.status === "survey") return null;

        const game = games.find(g => parseInt(g.id) === room.gameType);
        if (!game) throw new Error(`No game configuration found for room ${roomCode}`);

        const existingPracticeData = room.practiceData ?? {};
        if (existingPracticeData.status === "complete") {
            return null;
        }
        if (existingPracticeData.status === "in_progress") {
            if (!roundTimers[roomCode]) {
                const messages = existingPracticeData.messages ?? [];
                if (messages.length > 0 && messages.length === (room.userIds ?? []).length) {
                    await finalizePracticeRound(io, roomCode);
                } else {
                    startRoundTimer(
                        io,
                        roomCode,
                        0,
                        game.conversationTime,
                        () => finalizePracticeRound(io, roomCode)
                    );
                }
            }
            return null;
        }

        let instructions = "";
        if (game.instructions?.template) {
            const fishAvailable = room.fish_amount?.[1] ?? 100;
            instructions = fillPrompt(game.instructions.template, {
                curr_round: "practice",
                fish_available: fishAvailable
            });
        } else {
            instructions = await getLlmText(io, roomCode, true, false, { practice: true });
        }

        const practiceData = {
            status: "in_progress",
            instructions,
            messages: [],
            response: "",
            allocations: {},
            fishLeft: null,
            statusByUserId: {}
        };
        await updatePracticeData(practiceData, roomCode);

        if (game.instructions?.template) {
            // Same as getLlmInstructionsInner: users are navigating to the interaction
            // page right now, so give their listeners a moment to attach before
            // broadcasting (they also refresh on instructions-complete as a fallback).
            await delay(500);
            io.to(roomCode).emit("receive-message", {
                sender: "llm",
                text: instructions,
                id: "practice-instructions"
            });
        }
        io.to(roomCode).emit("instructions-complete", "practice");
        startRoundTimer(
            io,
            roomCode,
            0,
            game.conversationTime,
            () => finalizePracticeRound(io, roomCode)
        );
    } catch (err) {
        console.error(`[Practice] Could not start practice round in room ${roomCode}:`, err);
        io.to(roomCode).emit("practice-round-error", { message: "Could not start the practice round." });
    } finally {
        practiceRoundStarting.delete(roomCode);
    }
}

async function finalizePracticeRound(io, roomCode) {
    if (practiceRoundsFinalizing.has(roomCode)) return null;
    practiceRoundsFinalizing.add(roomCode);

    try {
        if (roundTimers[roomCode]) {
            clearTimeout(roundTimers[roomCode].timeout);
            delete roundTimers[roomCode];
        }

        const room = await getRoomSafely(roomCode);
        if (!room || room.status === "survey" || room.practiceData?.status !== "in_progress") {
            return null;
        }

        io.to(roomCode).emit("user-messages-complete");
        let response;
        try {
            response = await getLlmText(io, roomCode, false, true, { practice: true });
        } catch (err) {
            console.error(`[Practice] LLM response failed for room ${roomCode}:`, err);
            io.to(roomCode).emit("ai-end");
            response = "An error occurred generating the practice response.";
        }

        const latestRoom = await getRoomSafely(roomCode);
        if (!latestRoom || latestRoom.status === "survey") return null;

        await updatePracticeData({ status: "complete", response }, roomCode);

        io.to(roomCode).emit("timer-expired");
        // also rebuilt from practiceData on refresh (see loadRoomState), so it survives reloads
        io.to(roomCode).emit("receive-message", PRACTICE_FINISHED_MESSAGE);
        io.to(roomCode).emit("practice-round-complete");

        // The admin explicitly starts official play with the next button.
    } catch (err) {
        console.error(`[Practice] Could not finish practice round in room ${roomCode}:`, err);
        io.to(roomCode).emit("practice-round-error", { message: "Could not finish the practice round." });
    } finally {
        practiceRoundsFinalizing.delete(roomCode);
    }
}

export async function startOfficialGame(io, roomCode) {
    if (officialGameStarting.has(roomCode)) return null;
    officialGameStarting.add(roomCode);

    try {
        const room = await getRoomSafely(roomCode);
        if (!room || room.status === "survey") return null;

        const practiceData = room.practiceData ?? {};
        if (!room.practice || practiceData.status !== "complete" || practiceData.officialStarted) {
            return null;
        }

        await updatePracticeData({ officialStarted: true, officialComplete: false }, roomCode);
        io.to(roomCode).emit("official-game-started");
        await getLlmInstructions(io, roomCode, 1);
    } catch (err) {
        console.error(`[Game] Could not start official game in room ${roomCode}:`, err);
        const room = await getRoomSafely(roomCode);
        if (room?.practice) {
            await updatePracticeData({ officialStarted: false, officialComplete: false }, roomCode);
        }
        io.to(roomCode).emit("official-game-start-error", { message: "Could not start the game." });
    } finally {
        officialGameStarting.delete(roomCode);
    }
}

async function getLlmInstructionsInner(io, roomCode, round) {
    const room = await getRoomSafely(roomCode);
    if (!room || room.status === "survey") {
        deleteTimer(roomCode);
        return null;
    }
    const fish_amount = room.fish_amount ?? {};
    const game = games.find(g=> parseInt(g.id) === room.gameType);
    let instructions = "";
    if (game.instructions?.template) {
        // Safely look up fish available for this round; fall back to any existing entry or 100 if missing
        const existingRounds = Object.keys(fish_amount);
        const fallbackFish =
            (fish_amount && fish_amount[round] != null)
                ? fish_amount[round]
                : (existingRounds.length > 0
                    ? fish_amount[existingRounds[0]]
                    : 100);
        instructions = fillPrompt(game.instructions.template, {
            curr_round: round,
            fish_available: fallbackFish
        });
        const instruction_message = { sender: "llm", text: instructions, id: `llm-instructions-${round}` };
        // Persist before broadcasting: round-complete (and page mounts) trigger
        // refreshRoomState() on every client at roughly this same moment, which
        // re-fetches the room over REST and replaces the whole message list. If
        // that fetch lands before this write finishes, it rebuilds messages from
        // a room row that doesn't have this round's instructions yet and the
        // just-broadcast message gets wiped back out on whichever clients lost
        // the race. Writing first closes that window instead of just narrowing
        // it with a delay.
        await appendLlmInstructions(roomCode, round, instructions);
        await delay(500);
        io.to(roomCode).emit("receive-message", instruction_message);
    } else {
        instructions = await getLlmText(io, roomCode, true, false);
        await appendLlmInstructions(roomCode, round, instructions);
    }

    // await appendLlmInstructions(roomCode, round, instructions);

    io.to(roomCode).emit("instructions-complete", round);

    startRoundTimer(io, roomCode, round, game.conversationTime);
}


export async function submitUserMessages(io, roomCode, userId, userName, text) {
    // const userMsg = { sender: "user", userId: userId, userName: userName, text: text };
    const room = await getRoomSafely(roomCode);
    if(!room) {
        deleteTimer(roomCode);
        return null;
    }

    // Once a practice round has started, nothing sent before the official game
    // starts may land in the official round 1 userMessages. (Rooms that never
    // start a practice round, like automated tests, have no practice status and
    // go straight to the official path.)
    const practiceData = room.practiceData ?? {};
    if (room.practice && practiceData.status && !practiceData.officialStarted) {
        // a message arriving after the practice timer ran out wouldn't be in the LLM's prompt
        if (practiceData.status !== "in_progress" || practiceRoundsFinalizing.has(roomCode)) return;

        const { appended, practiceData: updated } = await appendPracticeMessage(roomCode, userId, text);
        if (!appended) return;
        const messages = updated.messages ?? [];
        io.to(roomCode).emit("change-users-messaged", { newSentMessages: messages.length });

        if (messages.length === (room.userIds ?? []).length) {
            await constructUserMessages(io, roomCode, { 0: messages }, 0);
            await delay(100);
            await finalizePracticeRound(io, roomCode);
        }
        return;
    }

    const round = room.curr_round;
    const existingUserMessages = room.userMessages;
    const roundMessages = existingUserMessages[round] ?? [];
    const alreadySubmitted = roundMessages.some(
        ([existingUserId]) => existingUserId === userId
    );

    if (alreadySubmitted) return;

    if(existingUserMessages) {
        if(!existingUserMessages[round]) {
            existingUserMessages[round] = [[userId, text]];
        } else {
            existingUserMessages[round].push([userId, text]);
        }
    }

    await updateUserMessages(existingUserMessages, roomCode);
    // io.to(roomCode).emit("receive-message", userMsg);

    io.to(roomCode).emit("change-users-messaged", { newSentMessages: existingUserMessages[round].length });

    if(existingUserMessages[round].length === room.userIds.length) {
        await constructUserMessages(io, roomCode, existingUserMessages, round);
        await delay(100);
        await getLlmResponse(io, roomCode, round); // if a user leaves in middle of round this is called before that user sends their message
    }    
}


export async function surveyComplete(io, roomCode, userId) {
    io.to(roomCode).emit("user-survey-complete", { userId, roomCode });
    const currRoom = await getRoomSafely(roomCode);
    if (!currRoom) {
        deleteTimer(roomCode);
        return null;
    }

    let surveyCompleted = true;
    for (const id of currRoom.userIds) {
        const { completed } = await getSurveyStatus(id)
        if (completed == 0) {
            surveyCompleted = false;
            break;
        }
    }

    if(surveyCompleted) {
        await roomCompleted(roomCode);
    }
}


function startRoundTimer(io, roomCode, round, conversationTime, onTimeout = () => getLlmResponse(io, roomCode)) {
    if (roundTimers[roomCode]) {
        clearTimeout(roundTimers[roomCode].timeout);
        delete roundTimers[roomCode];
    }

    const durationMs = conversationTime * 1000;
    const endTime = Date.now() + durationMs;

    io.to(roomCode).emit("timer-start", { duration: durationMs, endTime });

    const timeout = setTimeout(async () =>{
        io.to(roomCode).emit("timer-expired");
        const room = await getRoomSafely(roomCode);
        if (!room) {
            deleteTimer(roomCode);
            return;
        }
        const existingUserMessages = round === 0
            ? { 0: room.practiceData?.messages ?? [] }
            : room.userMessages;
        if (existingUserMessages?.[round]?.length) {
            await constructUserMessages(io, roomCode, existingUserMessages, round);
        }
        await delay(100);
        await onTimeout();
    }, durationMs);

    roundTimers[roomCode] = { timeout, endTime };
}

async function constructUserMessages(io, roomCode, existingUserMessages, round) {
    const allUserMessages = await Promise.all(
    existingUserMessages[round].map(async ([uid, txt]) => {
        const user = await getUser(uid);
        return {
            sender: "user",
            userId: uid,
            userName: user?.userName || `User ${uid}`,
            text: txt,
            id: `${uid}-${round}`
        };
    })
);
io.to(roomCode).emit("all-user-messages", { round, messages: allUserMessages });
}

export function getTimeLeft(io, roomCode) {
    if (!roundTimers[roomCode]) return;
    const { endTime } = roundTimers[roomCode];
    const timeLeft = endTime - Date.now();
    io.to(roomCode).emit("timer-start", { duration: timeLeft, endTime });
}

export function deleteTimer(roomCode) {
    if (!roundTimers[roomCode]) return;
    clearTimeout(roundTimers[roomCode].timeout);
    delete roundTimers[roomCode];
}
