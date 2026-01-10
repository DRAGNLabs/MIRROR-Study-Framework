const API_BASE = "http://localhost:3001/api"; // going to want to change this to import from config file

// creates new user in user table (logs them in)
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

// gets user with specified userId
export async function getUser(userId) {
  const response = await fetch(`${API_BASE}/users/${userId}`);
  if (!response.ok) throw new Error("Can't get user.");

  return response.json();
}

// export async function getUsersInRoom(roomCode) {
//   const response = await fetch(`${API_BASE}/users/${roomCode}`, {
//     method: "GET",
//     headers: { 'Content-Type': 'application/json' }
//   });
//   if(!response.ok) throw new Error("Error getting users in room");
//   return response.json();
// }