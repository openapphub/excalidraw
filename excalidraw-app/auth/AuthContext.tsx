/**
 * Auth：JWT + 账密登录（AstraDraw LoginDialog 同款）。
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { jwtDecode } from "jwt-decode";

import {
  useAtomValue,
  useSetAtom,
  userAtom,
  type User as AppUser,
} from "../app-jotai";
import {
  getAuthStatus,
  getCurrentUser,
  loginLocal as loginLocalApi,
  register as registerApi,
  type AuthStatus,
} from "./authApi";

export type User = AppUser & {
  isSuperAdmin?: boolean;
};

const REDIRECT_KEY = "astradraw_login_redirect";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (redirectPath?: string) => void;
  loginLocal: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  oidcConfigured: boolean;
  localAuthEnabled: boolean;
  registrationEnabled: boolean;
  isSuperAdmin: boolean;
};

const decodeJwtFallback = (): User | null => {
  const token = localStorage.getItem("token");
  if (!token) {
    return null;
  }
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 <= Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return {
      id: decoded.sub,
      subject: decoded.sub,
      login: decoded.login || decoded.email,
      email: decoded.email,
      avatarUrl: decoded.avatarUrl,
      name: decoded.name,
      isSuperAdmin: true,
    };
  } catch {
    localStorage.removeItem("token");
    return null;
  }
};

const toAppUser = (u: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}): User => ({
  id: u.id,
  subject: u.id,
  login: u.email,
  email: u.email,
  name: u.name || u.email,
  avatarUrl: u.avatarUrl || "",
  isSuperAdmin: true,
});

const startOidcLogin = (redirectPath?: string) => {
  if (redirectPath) {
    sessionStorage.setItem(REDIRECT_KEY, redirectPath);
  }
  window.location.href = "/auth/login";
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const user = useAtomValue(userAtom);
  const setUser = useSetAtom(userAtom);
  const [status, setStatus] = useState<AuthStatus>({
    oidcConfigured: true,
    localAuthEnabled: true,
    registrationEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const me = await getCurrentUser();
    if (me) {
      setUser(toAppUser(me));
      return;
    }
    setUser(decodeJwtFallback());
  }, [setUser]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    getAuthStatus()
      .then(setStatus)
      .catch(() => {});
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const loginLocal = useCallback(
    async (email: string, password: string) => {
      const result = await loginLocalApi(email, password);
      if (result.token) {
        localStorage.setItem("token", result.token);
      }
      setUser(toAppUser(result.user));
      return true;
    },
    [setUser],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await registerApi(email, password, name);
      if (result.token) {
        localStorage.setItem("token", result.token);
      }
      setUser(toAppUser(result.user));
      return true;
    },
    [setUser],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/";
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ? { ...user, isSuperAdmin: true } : null,
      isAuthenticated: !!user && !!localStorage.getItem("token"),
      isLoading,
      login: startOidcLogin,
      loginLocal,
      register,
      logout,
      refreshUser,
      oidcConfigured: status.oidcConfigured,
      localAuthEnabled: status.localAuthEnabled,
      registrationEnabled: status.registrationEnabled,
      isSuperAdmin: true,
    }),
    [user, isLoading, loginLocal, register, logout, refreshUser, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    const token = localStorage.getItem("token");
    return {
      user: null,
      isAuthenticated: !!token,
      isLoading: false,
      login: startOidcLogin,
      loginLocal: async () => false,
      register: async () => false,
      logout: () => {
        localStorage.removeItem("token");
        window.location.reload();
      },
      refreshUser: async () => {},
      oidcConfigured: true,
      localAuthEnabled: true,
      registrationEnabled: true,
      isSuperAdmin: true,
    };
  }
  return ctx;
};

export const consumeLoginRedirect = (): string | null => {
  const path = sessionStorage.getItem(REDIRECT_KEY);
  if (path) {
    sessionStorage.removeItem(REDIRECT_KEY);
  }
  return path;
};

export default AuthProvider;
