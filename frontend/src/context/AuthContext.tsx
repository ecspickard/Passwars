import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, UNAUTHORIZED_EVENT } from "../lib/api";
import {
  clearAuthStorage,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from "../lib/auth-storage";
import type { AuthResponse, User } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True while the initial session restore from localStorage is running. */
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-fetches /users/me and updates context + localStorage. Use this after
   * anything that changes user state server-side outside login/signup
   * (e.g. verifying or unlinking a Chess.com account). */
  refreshUser: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize synchronously from localStorage so a refresh never flashes a
  // "logged out" state before the effect below has a chance to run.
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isInitializing, setIsInitializing] = useState(true);

  // Quietly re-validate the cached session against the server on first load.
  useEffect(() => {
    const storedToken = getStoredToken();

    if (storedToken) {
      api
        .get<User>("/users/me")
        .then((freshUser) => {
          setUser(freshUser);
          setStoredUser(freshUser);
        })
        .catch(() => {
          // api.ts already dispatched UNAUTHORIZED_EVENT on a 401, which the
          // listener below turns into a logout. Any other error just keeps
          // the cached session around for now.
        })
        .finally(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  // Any REST call that comes back 401 forces a logout, from anywhere in the app.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const applyAuthResponse = (res: AuthResponse) => {
    setStoredToken(res.access_token);
    setStoredUser(res.user);
    setToken(res.access_token);
    setUser(res.user);
  };

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<AuthResponse>(
      "/auth/login",
      { username, password },
      { skipAuth: true },
    );
    applyAuthResponse(res);
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await api.post<AuthResponse>(
        "/auth/signup",
        { username, email, password },
        { skipAuth: true },
      );
      applyAuthResponse(res);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const freshUser = await api.get<User>("/users/me");
    setUser(freshUser);
    setStoredUser(freshUser);
    return freshUser;
  }, []);

  const value = useMemo(
    () => ({ user, token, isInitializing, login, signup, logout, refreshUser }),
    [user, token, isInitializing, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
