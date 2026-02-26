import { loadGames } from "../services/gameLoader.js"
import { streamLLM } from "../llm.js";
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, getUser, getSurveyStatus, roomCompleted, updateResourceAllocations, updateFishAmount } from "../services/roomsService.js";
import { jsonrepair } from "jsonrepair";

const games = loadGames();
const currRounds = {} // replace this to rely on database later

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fillPrompt(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

// used in start-round socket and getLlmResponse function
async function getLlmText(io, roomCode, getInstructions, getAllocation) { 
    const room = await getRoom(roomCode);
    const round = currRounds[roomCode];
    const game = games.find(g=> parseInt(g.id) === room.gameType);
    const systemPrompt = game.prompts[0].system_prompt;
    // might want to change the line below to be conditional if there is an instruction prompt (as some games we won't prompt LLM for instructions)
    const instructionsPrompt = game.prompts[0].instruction_prompt;
    const responsePrompt = game.prompts[0].response_prompt;
    const llmInstructions = room.llmInstructions ?? {};
    const llmResponses = room.llmResponse ?? {};
    const userMessages = room.userMessages ?? {};
    const fish_amount = room.fish_amount ?? {};

    const messages = [
        { "role": "system", "content": systemPrompt },
    ]

    for (let i = 1; i <= round; i++) {
        if (!game.instructions?.template) {
            messages.push({ "role": "user", "content": instructionsPrompt})
            // messages.push({ "role": "user", "content": fillPrompt(instructionsPrompt, { curr_round: round, fish_available: fish_amount[i] }) })
        } 
        if (!llmInstructions[i]) break;
        messages.push({ "role": "assistant", "content": llmInstructions[i] });
        const formattedUserMessages =  ( 
            await Promise.all(
                userMessages[i].map(async ([userId, text]) => {
                    const user = await getUser(userId) 
                    const name = user?.userName || `User ${userId}`;
                    return `${name}: ${text}`;
                })
            )
        ).join("\n");

        messages.push({"role": "user", "content": `${fillPrompt(responsePrompt, { fish_available: fish_amount[i] })} \n ${formattedUserMessages}` });
        if(!llmResponses[i]) break;
        messages.push({ "role": "assistant", "content": llmResponses[i] })
    }
    if(getInstructions) {
        await delay(500);
    }

    io.to(room.roomCode).emit("ai-start");

    let buffer = "";
    await streamLLM(messages, token => {
        buffer += token;
        io.to(room.roomCode).emit("ai-token", token); // allows tokens to be appended to LLM message as they come
    }, room.modelType);
    // lets interaciton and adminInteraciton know to reset everything since it has received the whole LLM message
    io.to(room.roomCode).emit("ai-end");

    // adding this check (when I do multiple returns with LLMs we won't be storing their messages in JSON objects, so should return buffer otherwise)
    if (!getAllocation) {
        return buffer;
    }
    
    let parsed;
    try {
        parsed = JSON.parse(buffer);
    } catch (err) {
        try {
            const repaired = jsonrepair(buffer);
            parsed = JSON.parse(repaired);
        } catch(err) {
            console.error("Unrecoverable JSON", err);
            fish_amount[round+1] = fish_amount[round];
            await updateFishAmount(fish_amount, roomCode);
            return buffer;
        }
    }

    const assistantMessage = typeof parsed.assistantMessage === "string"
        ? parsed.assistantMessage
        : "";
    const allocationByUserName =
        parsed.allocationByUserName && typeof parsed.allocationByUserName === "object"
            ? parsed.allocationByUserName
            : {};
    
    const fish_left = typeof parsed.fish_left === "number" ? parsed.fish_left : fish_amount[round];
    if (fish_left < 5) {
        fish_amount[round+1] = fish_left;
    } else if (fish_left > 50) {
        fish_amount[round+1] = 100;
    } else {
        fish_amount[round+1] = fish_left * 2;
    }
    await updateFishAmount(fish_amount, roomCode);

    const existingResourceAllocations = room.resourceAllocations ?? {};
    existingResourceAllocations[round] = {
        allocationByUserName,
        assistantMessage: assistantMessage || buffer
    };
    await updateResourceAllocations(existingResourceAllocations, roomCode);

    return assistantMessage || "The system updated resource allocation for this round";
    

    // return buffer;
}




// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(io, roomCode) {
    const round = currRounds[roomCode]; 
    const buffer = await getLlmText(io, roomCode, false, true);
    const room = await getRoom(roomCode);
    const fish_amount = room.fish_amount ?? {};
    const llmResponses = room.llmResponse ?? {};
    llmResponses[round] = buffer;
    await updateLlmResponse(llmResponses, roomCode);

    const totalRounds = room.numRounds;
    if (round >= totalRounds) {
        io.to(roomCode).emit("game-complete");
        const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended." };
        io.to(roomCode).emit("receive-message", endGameMsg);
        return;
    } else if (fish_amount[round+1] < 5) {
        // abort game if fish is below 5 tons
        const endGameMsg = { sender: "user", userName: "Admin", text: "Fish got below 5 tons, no more fish left to allocate game is over", id: "no-fish-left" };
        // for some reason users don't get message unless you do await delay(500)
        await delay(500);
        io.to(roomCode).emit("receive-message", endGameMsg);
        io.to(roomCode).emit("game-complete");
        return; 
    } else {
        console.log(`Round ${round} completed, waiting for next round...`);
    }

    currRounds[roomCode] += 1; 
    io.to(roomCode).emit("round-complete", currRounds[roomCode]);
    await getLlmInstructions(io, roomCode, currRounds[roomCode]);
}

export async function getLlmInstructions(io, roomCode, round) {
    if (!currRounds[roomCode]) {
        currRounds[roomCode] = round
    }
    const room = await getRoom(roomCode);
    const fish_amount = room.fish_amount;
    const game = games.find(g=> parseInt(g.id) === room.gameType);
    let instructions = "";
    if (game.instructions?.template) {
        instructions = fillPrompt(game.instructions.template, { curr_round: round, fish_available: fish_amount[round] });
        const instruction_message = { sender: "llm", text: instructions, id: `instructions-${round}` };
        // users don't receive instructions from socket if this await delay isn't here
        await delay(500); 
        io.to(roomCode).emit("receive-message", instruction_message);
    } else {
        instructions = await getLlmText(io, roomCode, true, false);
    }
    await appendLlmInstructions(roomCode, round, instructions);
    io.to(roomCode).emit("instructions-complete", round);
}


export async function submitUserMessages(io, roomCode, userId, userName, text) {
    const round = currRounds[roomCode];
    const userMsg = { sender: "user", userId: userId, userName: userName, text: text };
    const room = await getRoom(roomCode);
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
    io.to(roomCode).emit("receive-message", userMsg);

    if(existingUserMessages[round].length === room.userIds.length) {
        await getLlmResponse(io, roomCode, round); // if a user leaves in middle of round this is called before that user sends their message
    }    
}


export async function surveyComplete(io, roomCode, surveyId, userId) {
    io.to(roomCode).emit("user-survey-complete", { userId, surveyId });
    const currRoom = await getRoom(roomCode);

    let surveyCompleted = true;
    for (const id of currRoom.userIds) {
        const { completed } = await getSurveyStatus(userId)
        if (completed == 0) surveyCompleted = false;
    }

    if(surveyCompleted) {
        await roomCompleted(roomCode);
    }
}

