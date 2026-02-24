import { API_BASE } from "../src/config.js";

export async function adminLogin(password) { 
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",            
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) return { ok: false };
  return response.json();

}