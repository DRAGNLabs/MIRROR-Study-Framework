import { API_BASE } from "../config.js";

// creates new survey data in survey table
export async function sendSurvey(roomCode, userId, data) {
  const response = await fetch(`${API_BASE}/survey`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({roomCode, userId, data})
  });

  if(!response.ok) throw new Error("Error sending survey.");

  return response.json();
}

// gets all surveys in survey table
export async function getAllSurveys(){
  const response = await fetch(`${API_BASE}/survey`);
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
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

export async function getUsersSurvey(userId) {
  const response = await fetch(`${API_BASE}/survey/user/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }   
  });
  if (!response.ok) throw new Error("Error getting user's survey");
  return response.json();
}

//deletes a survey based on the roomCode
export async function deleteSurvey(roomCode) {
  const response = await fetch(`${API_BASE}/survey/delete/${roomCode}`, {
    method: 'DELETE', 
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error("Error deleting user's survey");
  }

  return response.json();
}