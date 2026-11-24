import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  updateProfile,
  type User,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  testConnection,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type { UserProfile, UserPrivateSettings } from '../types';
import { useApp } from './AppContext';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  privateSettings: UserPrivateSettings | null;
  authReady: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    username: string;
    birthYear?: number;
  }) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  confirmPhoneOtp: (
    confirmation: ConfirmationResult,
    code: string,
    extra?: { displayName?: string; username?: string; birthYear?: number }
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

declare global {
  interface Window {
    rainbowRecaptchaVerifier?: RecaptchaVerifier;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, theme, autoplay, shortsAutoplay, dataSaver, setLanguage, setTheme, setAutoplay, setShortsAutoplay, setDataSaver } = useApp();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateSettings, setPrivateSettings] = useState<UserPrivateSettings | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const ensureUserDocuments = useCallback(
    async (
      user: User,
      overrides?: { displayName?: string; username?: string; birthYear?: number }
    ) => {
      const now = new Date().toISOString();
      const currentYear = new Date().getFullYear();
      const birthYear = overrides?.birthYear;
      const isMinor = typeof birthYear === 'number' ? currentYear - birthYear < 18 : false;

      const userRef = doc(db, 'users', user.uid);
      const privRef = doc(db, 'users', user.uid, 'private', 'account');

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const fallbackName =
            overrides?.displayName?.trim() ||
            user.displayName?.trim() ||
            user.email?.split('@')[0] ||
            user.phoneNumber ||
            'Rainbow Creator';
          const cleanBase = (overrides?.username || fallbackName)
            .toLowerCase()
            .replace(/[^a-z0-9_.]/g, '')
            .slice(0, 24) || 'creator';
          const username = overrides?.username
            ? cleanBase
            : `${cleanBase}_${user.uid.slice(0, 5).toLowerCase()}`;

          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: fallbackName.slice(0, 80),
            username,
            photoURL: user.photoURL || '',
            coverURL: '',
            bio: '',
            followersCount: 0,
            followingCount: 0,
            videosCount: 0,
            isPrivate: false,
            showSavedPublicly: false,
            whoCanMessage: isMinor ? 'following' : 'everyone',
            isMinor,
            isRestricted: false,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(userRef, newProfile);
        }

        const privSnap = await getDoc(privRef);
        if (!privSnap.exists()) {
          const newPriv: UserPrivateSettings = {
            uid: user.uid,
            ...(user.email ? { email: user.email } : {}),
            ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
            ...(typeof birthYear === 'number' ? { birthYear } : {}),
            language,
            theme,
            autoplay,
            shortsAutoplay,
            dataSaver,
            updatedAt: now,
          };
          await setDoc(privRef, newPriv);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    },
    [language, theme, autoplay, shortsAutoplay, dataSaver]
  );

  const verifyServerAdmin = useCallback(async (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { isAdmin?: boolean };
        setIsAdmin(Boolean(data.isAdmin));
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    testConnection();
    let unsubProfile: (() => void) | null = null;
    let unsubPrivate: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubPrivate) {
        unsubPrivate();
        unsubPrivate = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setPrivateSettings(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      await ensureUserDocuments(user);
      verifyServerAdmin(user);

      const userRef = doc(db, 'users', user.uid);
      unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
          setAuthReady(true);
        },
        (error) => {
          console.error('Profile listener error:', error);
          setAuthReady(true);
        }
      );

      const privRef = doc(db, 'users', user.uid, 'private', 'account');
      unsubPrivate = onSnapshot(
        privRef,
        (snap) => {
          if (snap.exists()) {
            const p = snap.data() as UserPrivateSettings;
            setPrivateSettings(p);
            if (p.language) setLanguage(p.language);
            if (p.theme) setTheme(p.theme);
            if (typeof p.autoplay === 'boolean') setAutoplay(p.autoplay);
            if (typeof p.shortsAutoplay === 'boolean') setShortsAutoplay(p.shortsAutoplay);
            if (typeof p.dataSaver === 'boolean') setDataSaver(p.dataSaver);
          }
        },
        (error) => {
          console.error('Private settings listener error:', error);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubPrivate) unsubPrivate();
    };
  }, [ensureUserDocuments, verifyServerAdmin, setLanguage, setTheme, setAutoplay, setShortsAutoplay, setDataSaver]);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocuments(result.user);
    await verifyServerAdmin(result.user);
  };

  const registerWithEmail = async (params: {
    email: string;
    password: string;
    displayName: string;
    username: string;
    birthYear?: number;
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
    await updateProfile(cred.user, { displayName: params.displayName });
    await sendEmailVerification(cred.user);
    await ensureUserDocuments(cred.user, {
      displayName: params.displayName,
      username: params.username,
      birthYear: params.birthYear,
    });
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocuments(cred.user);
    await verifyServerAdmin(cred.user);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendPhoneOtp = async (
    phoneNumber: string,
    recaptchaContainerId: string
  ): Promise<ConfirmationResult> => {
    if (window.rainbowRecaptchaVerifier) {
      try {
        window.rainbowRecaptchaVerifier.clear();
      } catch {
        // ignore clear error
      }
      window.rainbowRecaptchaVerifier = undefined;
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
    window.rainbowRecaptchaVerifier = verifier;
    return signInWithPhoneNumber(auth, phoneNumber, verifier);
  };

  const confirmPhoneOtp = async (
    confirmation: ConfirmationResult,
    code: string,
    extra?: { displayName?: string; username?: string; birthYear?: number }
  ) => {
    const cred = await confirmation.confirm(code);
    if (extra?.displayName) {
      await updateProfile(cred.user, { displayName: extra.displayName });
    }
    await ensureUserDocuments(cred.user, extra);
    await verifyServerAdmin(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setPrivateSettings(null);
    setIsAdmin(false);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    }
    await verifyServerAdmin(auth.currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateSettings,
        authReady,
        isAdmin,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        resendVerificationEmail,
        resetPassword,
        sendPhoneOtp,
        confirmPhoneOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
