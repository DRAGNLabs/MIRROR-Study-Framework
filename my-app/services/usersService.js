const API_BASE = "http://localhost:3001/api"; // going to want to change this to import from config file

export async function loginUser(userName, roomCode) {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({userName, roomCode })
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