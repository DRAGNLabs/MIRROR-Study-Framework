const port = process.env.PORT || 3001;
const API_BASE = process.env.API_BASE || `http://localhost:${port}/api`;
/*
 This file is here because I didn't want to import from the frontend into the backend, 
 I'm updating most of the room stuff in the index.js instead of in the frontend (more secure), 
 originally I was going to do it from admin but if they rerender than the userMessages will be reset
 And llmInstructions and llmResponses are generated in index.js so it makes sense to update the backend there
*/

export async function getRoom(roomCode) {
  const response = await fetch(`${API_BASE}/rooms/${roomCode}`);
  if (!response.ok) throw new Error("Can't get room.");

  return response.json();
}

export async function updateLlmInstructions(llmInstructions, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/llmInstructions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmInstructions })
    })
    if (!response.ok) throw new Error(`Error updating llmInstructions in room ${roomCode}`);
    return response.json();
}

export async function appendLlmInstructions(roomCode, round, text) {
    const room = await getRoom(roomCode);
    
    const instructions = room.llmInstructions ?? {};
    
     if (instructions[round]) {
        throw new Error(`Instructions in round ${round} already exists`);
     }

     instructions[round] = text;

     await updateLlmInstructions(instructions, roomCode);
}

export async function updateUserMessages(userMessages, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/userMessages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessages })
    })
    if (!response.ok) throw new Error(`Error updating userMessages in room ${roomCode}`);
    return response.json();
}

export async function updateLlmResponse(llmResponse, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/llmResponse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmResponse })
    })
    if (!response.ok) throw new Error(`Error updating llmResponse in room ${roomCode}`);
    return response.json();
}

export async function roomCompleted(roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/completed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error(`Error updating start and userIds in room ${roomCode}`);
    return response.json();
}