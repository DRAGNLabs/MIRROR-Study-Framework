const API_BASE = "http://localhost:3001/api"; // going to want to change this to import from config file


export async function sendSurvey(surveyId, userId, data) {
  const response = await fetch(`${API_BASE}/survey`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({surveyId, userId, data})
  });

  if(!response.ok) throw new Error("Error sending survey.");

  return response.json();
}

export async function getAllSurveys(){
  const response = await fetch(`${API_BASE}/survey`);
  if (!response.ok) throw new Error("Error fetching the surveys from the database.");
  return response.json();
}
