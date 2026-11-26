import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/api';
import { auth, googleProvider } from '../lib/firebase';
import type { UserPublic } from '../types';

export interface EmailSignupParams {
  name: string;
  email: string;
  password: string;
  city: string;
}

interface AuthContextValue {
  user: UserPublic | null;
  authReady: boolean;
  isAuthenticated: boolean;
  emailVerified: boolean;
  loginWithGoogle: (preferredCity?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (params: EmailSignupParams) => Promise<{ verificationEmailSent: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordResetWithCode: (oobCode: string, newPassword: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  updateCity: (city: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pendingCityRef = useRef<string | undefined>(undefined);
  const pendingNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      const chosenCity = pendingCityRef.current;
      const chosenName = pendingNameRef.current;
      const effectiveUser = {
        uid: fbUser.uid,
        displayName: fbUser.displayName || chosenName || null,
        email: fbUser.email,
        emailVerified: fbUser.emailVerified,
      };

      try {
        const synced = await authApi.syncSignedInUser(effectiveUser, chosenCity);
        setUser(synced);
      } catch (err) {
        console.error('Failed to sync Firebase user profile:', err);
        setUser({
          id: fbUser.uid,
          name: effectiveUser.displayName || fbUser.email?.split('@')[0] || 'Reader',
          email: fbUser.email || '',
          city: chosenCity || 'Quetta',
          createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
          emailVerified: fbUser.emailVerified,
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

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const synced = await authApi.syncSignedInUser(credential.user, pendingCityRef.current);
    setUser(synced);
  }, []);

  const signupWithEmail = useCallback(async (params: EmailSignupParams) => {
    const cleanName = params.name.trim();
    const cleanEmail = params.email.trim();
    const cleanCity = params.city.trim() || 'Quetta';

    pendingNameRef.current = cleanName;
    pendingCityRef.current = cleanCity;

    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      await updateProfile(credential.user, { displayName: cleanName });

      let verificationEmailSent = false;
      try {
        await sendEmailVerification(credential.user);
        verificationEmailSent = true;
      } catch {
        verificationEmailSent = false;
      }

      const synced = await authApi.syncSignedInUser(
        {
          uid: credential.user.uid,
          displayName: cleanName,
          email: credential.user.email,
          emailVerified: credential.user.emailVerified,
        },
        cleanCity,
      );
      setUser(synced);
      return { verificationEmailSent };
    } finally {
      pendingNameRef.current = undefined;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const confirmPasswordResetWithCode = useCallback(async (oobCode: string, newPassword: string) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Please sign in first to resend a verification email.');
    }
    await sendEmailVerification(current);
  }, []);

  const refreshVerificationStatus = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) {
      return false;
    }
    await current.reload();
    await current.getIdToken(true);
    const refreshed = auth.currentUser;
    if (!refreshed) {
      return false;
    }
    const synced = await authApi.syncSignedInUser(refreshed, pendingCityRef.current);
    setUser(synced);
    if (refreshed.emailVerified) {
      pendingCityRef.current = undefined;
    }
    return refreshed.emailVerified;
  }, []);

  const updateCity = useCallback(async (city: string) => {
    const updated = await authApi.updateCity(city);
    setUser(updated);
  }, []);

  const logout = useCallback(async () => {
    pendingCityRef.current = undefined;
    pendingNameRef.current = undefined;
    await signOut(auth);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(user && auth.currentUser);
  const emailVerified = Boolean(auth.currentUser?.emailVerified ?? user?.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAuthenticated,
        emailVerified,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        sendPasswordReset,
        confirmPasswordResetWithCode,
        resendVerificationEmail,
        refreshVerificationStatus,
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
