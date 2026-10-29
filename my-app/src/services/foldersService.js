import { API_BASE } from "../config.js";

// gets all completed-room folders
export async function getFolders() {
  const response = await fetch(`${API_BASE}/folders`);
  if (!response.ok) throw new Error("Error fetching folders.");
  return response.json();
}

// creates a folder, optionally moving the given rooms into it
export async function createFolder(name, description, roomCodes = []) {
  const response = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, roomCodes }),
  });
  if (!response.ok) throw new Error("Error creating folder.");
  return response.json();
}

// updates a folder's name/description
export async function updateFolder(id, { name, description }) {
  const response = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) throw new Error("Error updating folder.");
  return response.json();
}

// deletes a folder (rooms inside it are kept and become unfiled)
export async function deleteFolder(id) {
  const response = await fetch(`${API_BASE}/folders/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Error deleting folder.");
  return response.json();
}
