import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  authApi,
  setAuthTokenProvider,
  setUnauthorizedHandler,
} from '../lib/api';
import type { UserPublic } from '../types';

interface AuthContextValue {
  user: UserPublic | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, city: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Held strictly in React memory for session security
  const [user, setUser] = useState<UserPublic | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const applySession = useCallback((nextToken: string | null, nextUser: UserPublic | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    applySession(null, null);
  }, [applySession]);

  useEffect(() => {
    setAuthTokenProvider(() => tokenRef.current);
    setUnauthorizedHandler(logout);
    return () => {
      setAuthTokenProvider(() => null);
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      applySession(data.token, data.user);
    },
    [applySession],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, city: string) => {
      const data = await authApi.signup({ name, email, password, city });
      applySession(data.token, data.user);
    },
    [applySession],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
