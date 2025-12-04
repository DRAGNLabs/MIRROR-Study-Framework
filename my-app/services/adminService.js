const API_BASE = "http://localhost:3001/api";

export async function adminLogin(password) { 
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",            
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) return { ok: false };
  return response.json();

}