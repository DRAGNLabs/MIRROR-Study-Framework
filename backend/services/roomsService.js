// [Railway] API_BASE reads from env vars so this works in any environment.
// In production on Railway, the backend calls its own API via localhost loopback
// using the PORT that Railway assigns. In local dev, defaults to port 3001.
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

export async function updateResourceAllocations(resourceAllocations, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/resourceAllocations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceAllocations })
    });
    if (!response.ok) throw new Error(`Error updating resourceAllocations in room ${roomCode}`);
    return response.json();
}

export async function updateFishAmount(fishAmount, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/fishAmount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fishAmount })
    });
    if (!response.ok) throw new Error(`Error updating fishAmount in room ${roomCode}`);
    return response.json();
}


// these should probably be in different service file (this one in userService and other in surveyService),
// I just felt like it was annoying to have one function in each file so added them to this one
export async function getUser(userId) {
    const response = await fetch(`${API_BASE}/users/${userId}`);
    if (!response.ok) throw new Error("Can't get user.");

    return response.json();
}

// for adminSurvey page, checking if each user has finished their survey
export async function getSurveyStatus(userId) {
  const response = await fetch(`${API_BASE}/survey/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if(!response.ok) throw new Error("Error getting survey status");
  return response.json();
}