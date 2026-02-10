import { loadGames } from "../services/gameLoader.js"
import { streamLLM } from "../llm.js";
import { getRoom, appendLlmInstructions, updateLlmResponse, updateUserMessages, getUser, getSurveyStatus, roomCompleted } from "../services/roomsService.js";


const games = loadGames();
const currRounds = {} // replace this to rely on database later

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// used in start-round socket and getLlmResponse function
async function getLlmText(io, roomCode, getInstructions) { 
    const room = await getRoom(roomCode);
    const round = currRounds[roomCode];
    const game = games.find(g=> parseInt(g.id) === room.gameType);
    const systemPrompt = game.prompts[0].system_prompt;
    const instructionsPrompt = game.prompts[0].instruction_prompt;
    const responsePrompt = game.prompts[0].response_prompt;
    const llmInstructions = room.llmInstructions ? JSON.parse(room.llmInstructions) : {};
    const llmResponses = room.llmResponse ? JSON.parse(room.llmResponse) : {};
    const userMessages = room.userMessages ? JSON.parse(room.userMessages) : {};

    const messages = [
        { "role": "system", "content": systemPrompt },
    ]

    for (let i = 1; i <= round; i++) {
        messages.push({ "role": "user", "content": instructionsPrompt })
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

        messages.push({"role": "user", "content": `${responsePrompt} \n ${formattedUserMessages}` });
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
    });
    // lets interaciton and adminInteraciton know to reset everything since it has received the whole LLM message
    io.to(room.roomCode).emit("ai-end"); 
    return buffer;
}




// this function is meant to get the LLM response when all users have responded
async function getLlmResponse(io, roomCode) {
    const round = currRounds[roomCode]; 
    const room = await getRoom(roomCode);
    const buffer = await getLlmText(io, roomCode, false);
    const llmResponses = JSON.parse(room.llmResponse);
    llmResponses[round] = buffer;
    await updateLlmResponse(llmResponses, roomCode);

    const totalRounds = room.numRounds;
    if (round >= totalRounds) {
        io.to(roomCode).emit("game-complete");
        const endGameMsg = { sender: "user", userName: "Admin", text: "All rounds are complete, game is ended." };
        io.to(roomCode).emit("receive-message", endGameMsg);
        return;
    } 
    else {
        console.log(`Round ${round} completed, waiting for next round...`);
    }

    currRounds[roomCode] += 1; 
    io.to(roomCode).emit("round-complete", currRounds[roomCode]);
}

export async function getLlmInstructions(io, roomCode, round) {
    if (!currRounds[roomCode]) {
        currRounds[roomCode] = round
    }
    console.log("starting round:", round);
    const room = await getRoom(roomCode);
    const buffer = await getLlmText(io, roomCode, true);
    await appendLlmInstructions(roomCode, round, buffer);
    io.to(roomCode).emit("instructions-complete", round);
}


export async function submitUserMessages(io, roomCode, userId, userName, text) {
    const round = currRounds[roomCode];
    const userMsg = { sender: "user", userId: userId, userName: userName, text: text };
    const room = await getRoom(roomCode);
    const existingUserMessages = JSON.parse(room.userMessages);
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

    if(existingUserMessages[round].length === JSON.parse(room.userIds).length) {
        await getLlmResponse(io, roomCode, round); // if a user leaves in middle of round this is called before that user sends their message
    }    
}


export async function surveyComplete(io, roomCode, surveyId, userId) {
    io.to(roomCode).emit("user-survey-complete", { userId, surveyId });
    const currRoom = await getRoom(roomCode);

    let surveyCompleted = true;
    for (const id of JSON.parse(currRoom.userIds)) {
        const { completed } = await getSurveyStatus(userId)
        if (completed == 0) surveyCompleted = false;
    }

    if(surveyCompleted) {
        await roomCompleted(roomCode);
    }
}

