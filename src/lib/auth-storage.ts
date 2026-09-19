// Single source of truth for reading/writing the JWT in localStorage.
// Kept separate from AuthContext so lib/api.ts can read the token without
// importing React context (which would create a circular dependency).

const TOKEN_KEY = "passwars.token";
const USER_KEY = "passwars.user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearAuthStorage() {
  setStoredToken(null);
  setStoredUser(null);
}
