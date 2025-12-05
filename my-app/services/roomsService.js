const API_BASE = "http://localhost:3001/api"; // going to want to change this to import from config file

// creates new room in rooms table
export async function sendRoom(roomCode, gameType, numRounds, usersNeeded, modelType){ 
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({roomCode: Number(roomCode), gameType: Number(gameType), numRounds: Number(numRounds), usersNeeded: Number(usersNeeded), modelType}), //do we need the Number() function, idk
  })
  if(!res.ok) throw new Error("Error creating room.");

  return res.json();
}

// get room with specified roomCode
export async function getRoom(roomCode) {
  const response = await fetch(`${API_BASE}/rooms/${roomCode}`);
  if (!response.ok) throw new Error("Can't get room.");

  return response.json();
}

// updates started when admin clicks start room
export async function roomStarted(roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/started`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`Error updating started in room ${roomCode}`);
    return response.json();
}

// updates userIds when admin directs users to interactions page
export async function updateUserIds(userIds, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/userIds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
    })
    if (!response.ok) throw new Error(`Error updating userIds in room ${roomCode}`);
    return response.json();
}

// updates llmInstructions when LLM sends the instructions each round
export async function updateLlmInstructions(llmInstructions, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/llmInstructions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmInstructions })
    })
    if (!response.ok) throw new Error(`Error updating llmInstructions in room ${roomCode}`);
    return response.json();
}

// updates userMessages when users send their messages each round
export async function updateUserMessages(userMessages, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/userMessages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessages })
    })
    if (!response.ok) throw new Error(`Error updating userMessages in room ${roomCode}`);
    return response.json();
}

// updates llmResponse when LLM sends the response each round
export async function updateLlmResponse(llmResponse, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/llmResponse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmResponse })
    })
    if (!response.ok) throw new Error(`Error updating llmResponse in room ${roomCode}`);
    return response.json();
}

// updates that room is completed when admin sends users to survey page
export async function roomCompleted(roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/completed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error(`Error updating start and userIds in room ${roomCode}`);
    return response.json();
}

// checks if roomCode is valid when creating new room
export async function validRoomCode(roomCode){
  const response = await fetch(`${API_BASE}/rooms/valid`,{
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode })
  })
  if(!response.ok) throw new Error("Error validating room.");
  return response.json();
}

// closes/deletes a room with a specified roomCode
export async function closeARoom(roomCode){
  const response = await fetch(`${API_BASE}/rooms/delete/${roomCode}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
  return response.json();
}

// gets all rooms in rooms table
export async function getCreatedRooms(){
  const response = await fetch(`${API_BASE}/rooms`);
  if (!response.ok) throw new Error("Error fetching the rooms from the database.");
  return response.json();
}

// gets rooms that are not set as completed to put on admin page
export async function getOpenRooms() {
    const response = await fetch(`${API_BASE}/rooms/nonCompleted`);
    if(!response.ok) throw new Error("Error fetching non completed rooms from the database");
    return response.json();
}

// check that user can log into room
export async function loginRoom(roomCode){
  const response = await fetch(`${API_BASE}/rooms/${roomCode}/login`,{
    method: 'GET', 
    headers: { 'Content-Type': 'application/json' }
  })
  if(!response.ok) throw new Error("Error validating room.");
  return response.json();
}