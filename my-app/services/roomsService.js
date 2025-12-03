const API_BASE = "http://localhost:3001/api"; // going to want to change this to import from config file

export async function sendRoom(roomCode, gameType, numRounds, usersNeeded, modelType){
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({roomCode, gameType, numRounds, usersNeeded: Number(usersNeeded), modelType}),
  })
  if(!res.ok) throw new Error("Error creating room.");

  return res.json();
}


export async function getRoom(roomCode) {
  const response = await fetch(`${API_BASE}/rooms/${roomCode}`);
  if (!response.ok) throw new Error("Can't get room.");

  return response.json();
}

export async function roomStarted(userIds, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/started`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
    })
    if (!response.ok) throw new Error(`Error updating start and userIds in room ${roomCode}`);
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

export async function validRoomCode(roomCode){
  const response = await fetch(`${API_BASE}/rooms/valid`,{
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode })
  })
  if(!response.ok) throw new Error("Error validating room.");
  return response.json();
}

export async function closeARoom(roomCode){
  const response = await fetch(`${API_BASE}/rooms/delete/${roomCode}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
  return response.json();
}


export async function getCreatedRooms(){
  const response = await fetch(`${API_BASE}/rooms`);
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
  return response.json();
}