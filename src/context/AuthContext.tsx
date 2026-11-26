import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/api';
import { auth, googleProvider } from '../lib/firebase';
import type { UserPublic } from '../types';

interface AuthContextValue {
  user: UserPublic | null;
  authReady: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (preferredCity?: string) => Promise<void>;
  updateCity: (city: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pendingCityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      const chosenCity = pendingCityRef.current;
      try {
        const synced = await authApi.syncSignedInUser(fbUser, chosenCity);
        setUser(synced);
      } catch (err) {
        console.error('Failed to sync Firebase user profile:', err);
        setUser({
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Reader',
          email: fbUser.email || '',
          city: chosenCity || 'Quetta',
          createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        });
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async (preferredCity?: string) => {
    pendingCityRef.current = preferredCity;
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const synced = await authApi.syncSignedInUser(credential.user, preferredCity);
      setUser(synced);
    } finally {
      pendingCityRef.current = undefined;
    }
  }, []);

  const updateCity = useCallback(async (city: string) => {
    const updated = await authApi.updateCity(city);
    setUser(updated);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAuthenticated: Boolean(user && auth.currentUser),
        loginWithGoogle,
        updateCity,
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
