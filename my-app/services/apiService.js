// src/services/apiService.js
const API_BASE = "http://localhost:3001/api";

export async function loginUser(name, roomCode) {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({userName: name, roomCode: roomCode })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json();
}

export async function getUser(userId) {
  const response = await fetch(`${API_BASE}/users/${userId}`);
  if (!response.ok) throw new Error("Can't get user.");

  return response.json();
}

export async function sendSurvey(userId, userName, data) {
  const response = await fetch(`${API_BASE}/survey/${userId}`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({userName: userName, surveyData: data})
  });
  if(!response.ok) throw new Error("Error sending survey.");

  return response.json();
}

export async function getAllSurveys(){
  const response = await fetch(`${API_BASE}/survey`);
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
  return response.json();
}


export async function calltoLLM(userId, prompt){
  const response = await fetch(`${API_BASE}/llm-response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({id: userId, prompt: prompt })
  });
  if(!response.ok) throw new Error("Can't call to LLM.");
  return response.json();
}

export async function sendLLMData(userId, prompt, response){
  const res = await fetch(`${API_BASE}/llm-response/${userId}`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({id: userId, promtp: prompt, response: response})
  })

  if(!res.ok) throw new Error("Error uploading responses and prompts to db.");

  return res.json();
}

export async function sendCreatedRoom(roomCode, count, games){
  const res = await fetch(`${API_BASE}/rooms/create`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({roomCode: roomCode, count: Number(count), gamesSelected: games, users: "[]"}),
  })
  if(!res.ok) throw new Error("Error creating room.");

  return res.json();
}

export async function getCreatedRooms(){
  const res = await fetch(`${API_BASE}/rooms`);
  if (!res.ok) throw new Error("Error fetching the surveys from the database.");
  return res.json();
}


