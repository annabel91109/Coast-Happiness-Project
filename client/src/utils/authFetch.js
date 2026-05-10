import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE || "";

/**
 * Authenticated fetch wrapper. Attaches Firebase ID token as Bearer token.
 * @param {"GET"|"POST"|"PUT"|"DELETE"} method
 * @param {string} path - API path e.g. "/api/cleanups"
 * @param {object} [body] - JSON body for POST/PUT
 * @returns {Promise<object>} parsed JSON response
 */
export async function authFetch(method, path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // Local dev fallback: server middleware reads these instead of verifying the token
      "x-uid": user.uid,
      "x-email": user.email || "",
      "x-display-name": user.displayName || user.email || user.uid,
    },
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}
