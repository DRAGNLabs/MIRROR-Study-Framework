const port = process.env.PORT || 3001;
const API_BASE = process.env.API_BASE || `http://localhost:${port}/api`;

export async function getUser(userId) {
    const response = await fetch(`${API_BASE}/users/${userId}`);
    if (!response.ok) throw new Error("Can't get user.");

    return response.json();
}

export async function updateUserStatus(userId, user_status) {
    const response = await fetch(`${API_BASE}/users/${userId}/user_status`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_status })
    });
    if (!response.ok) throw new Error("Failed to update user status.");
    return response.json();
}

// Used to create the simulated bot users for an automated test run.
export async function createUser(userName, roomCode) {
    const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, roomCode })
    });
    if (!response.ok) throw new Error("Failed to create user.");
    return response.json();
}

export async function setUserRole(userId, role) {
    const response = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
    });
    if (!response.ok) throw new Error("Failed to set user role.");
    return response.json();
}