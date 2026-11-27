import { API_BASE } from "../config.js";

// gets a game file's roles + role_prompt fresh from disk, plus whether saving is allowed (MODE=local)
export async function getGameRoles(gameId) {
  const response = await fetch(`${API_BASE}/games/${gameId}/roles`);
  if (!response.ok) throw new Error("Error loading roles.");
  return response.json();
}

// writes roles + role_prompt back to the game file. hash is the one from getGameRoles,
// so the save is refused if the file changed on disk in the meantime
export async function saveGameRoles(gameId, { roles, role_prompt, hash }) {
  const response = await fetch(`${API_BASE}/games/${gameId}/roles`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles, role_prompt, hash }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error saving roles.");
  return data;
}
