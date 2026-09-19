// Thin fetch wrapper used by every REST call in the app.
//
// - Attaches `Authorization: Bearer <token>` automatically from whatever
//   token is currently stored (see auth-storage.ts).
// - Centralizes error handling: a 401 on an *authenticated* request fires a
//   global "unauthorized" event that AuthContext turns into a forced logout.
//   A 401 on a `skipAuth` request (login) is NOT a session problem - it's the
//   backend saying "wrong credentials" - so it surfaces the backend's own
//   message and leaves the session alone.
// - Throws an `ApiError` on any non-2xx response. FastAPI 422 validation
//   errors are also broken out per field (`fieldErrors`) so forms can show
//   them next to the right input.

import { getStoredToken } from "./auth-storage";

export class ApiError extends Error {
  status: number;
  /** Per-field messages from FastAPI 422 responses, keyed by field name. */
  fieldErrors: Record<string, string>;
  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Fired on any 401 from an authenticated request so AuthContext (which owns
// the session) can react without api.ts importing AuthContext (a cycle).
export const UNAUTHORIZED_EVENT = "passwars:unauthorized";

function dispatchUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

interface ParsedError {
  message: string;
  fieldErrors: Record<string, string>;
}

// Pydantic prefixes custom validator messages with "Value error, " and
// starts lowercase; tidy both so they read like UI copy.
function prettifyValidationMessage(msg: string): string {
  const cleaned = msg.replace(/^Value error,\s*/i, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function parseError(res: Response): Promise<ParsedError> {
  try {
    const body = await res.clone().json();

    if (typeof body?.detail === "string") {
      return { message: body.detail, fieldErrors: {} };
    }

    if (Array.isArray(body?.detail)) {
      const fieldErrors: Record<string, string> = {};
      const messages: string[] = [];

      for (const item of body.detail as { loc?: (string | number)[]; msg?: string }[]) {
        const msg = prettifyValidationMessage(item.msg ?? "Invalid value");
        const loc = item.loc ?? [];
        const field = loc.length >= 2 ? loc[loc.length - 1] : undefined;

        if (typeof field === "string") {
          if (!(field in fieldErrors)) fieldErrors[field] = msg;
          messages.push(`${field}: ${msg}`);
        } else {
          messages.push(msg);
        }
      }

      return { message: messages.join(". "), fieldErrors };
    }
  } catch {
    // body wasn't JSON, fall through
  }
  return { message: res.statusText || "Something went wrong", fieldErrors: {} };
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

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !skipAuth) {
    dispatchUnauthorized();
    throw new ApiError(401, "Your session expired. Please log in again.");
  }

  if (!res.ok) {
    const { message, fieldErrors } = await parseError(res);
    throw new ApiError(res.status, message, fieldErrors);
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
