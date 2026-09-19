// Thin fetch wrapper used by every REST call in the app.
//
// - Attaches `Authorization: Bearer <token>` automatically from whatever
//   token is currently stored (see auth-storage.ts).
// - Centralizes error handling: any 401 fires a global "unauthorized" event
//   that AuthContext listens for and turns into a forced logout, instead of
//   every call site having to check `res.status === 401` itself.
// - Throws an `ApiError` with the parsed message on any non-2xx response so
//   callers can show it in a toast.

import { getStoredToken } from "./auth-storage";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Fired on any 401 so AuthContext (which owns the session) can react
// without api.ts needing to import AuthContext and create a cycle.
export const UNAUTHORIZED_EVENT = "passwars:unauthorized";

function dispatchUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.clone().json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg).join(", ");
    }
  } catch {
    // body wasn't JSON, fall through
  }
  return res.statusText || "Something went wrong";
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. login/signup). */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    dispatchUnauthorized();
    throw new ApiError(401, "Your session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
