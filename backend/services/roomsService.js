const API_BASE = "http://localhost:3001/api";

export async function appendLlmInstructions(roomCode, round, text) {
    const room = await getRoomByCode(roomCode);
    
    const instructions = room.llmInstructions
     ? JSON.parse(room.llmInstructions) : {};
    
     if (instructions[round]) {
        throw new Error(`Round ${round} already exists`);
     }

     instructions[round] = text;

     await updateLlmInstructions(roomCode, JSON.stringify(instructions));
}


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

export async function updateLlmResponse(llmResponse, roomCode) {
    const response = await fetch(`${API_BASE}/rooms/${roomCode}/llmResponse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmResponse })
    })
    if (!response.ok) throw new Error(`Error updating llmResponse in room ${roomCode}`);
    return response.json();
}