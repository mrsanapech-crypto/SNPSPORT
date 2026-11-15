import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import firebaseConfig from '../firebase-applet-config.json';

const hasValidFirebaseKey =
  Boolean(firebaseConfig?.apiKey) &&
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.apiKey !== 'MY_FIREBASE_API_KEY';

const app = initializeApp(
  hasValidFirebaseKey
    ? firebaseConfig
    : {
        ...firebaseConfig,
        apiKey: firebaseConfig?.apiKey || 'AIzaSyDummyKeyForLocalFallback000000000',
      }
);

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const LOCAL_AUTH_STORAGE_KEY = 'ks_google_user_profile_v1';
const authListeners = new Set<(user: AppUser | null) => void>();

export function getStoredLocalUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string') {
      return parsed as AppUser;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function setStoredLocalUser(profile: AppUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  authListeners.forEach((cb) => cb(profile));
}

export function subscribeToAuthChanges(callback: (user: AppUser | null) => void): () => void {
  authListeners.add(callback);

  // Immediately emit stored local user if present
  const existingLocal = getStoredLocalUser();
  if (existingLocal) {
    callback(existingLocal);
  }

  const unsubFirebase = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const mapped: AppUser = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      };
      setStoredLocalUser(mapped);
      callback(mapped);
    } else {
      const fallbackUser = getStoredLocalUser();
      callback(fallbackUser);
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubFirebase();
  };
}

export function completeFallbackGoogleSignIn(emailInput: string, nameInput?: string): AppUser {
  const cleanEmail = (emailInput || '').trim().toLowerCase() || 'user@gmail.com';
  const defaultName = cleanEmail.split('@')[0].replace(/[._-]+/g, ' ');
  const displayName =
    (nameInput || '').trim() ||
    defaultName.replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Google User';

  const profile: AppUser = {
    uid: `google-${cleanEmail.replace(/[^a-z0-9]/g, '')}`,
    displayName,
    email: cleanEmail,
    photoURL: null,
  };
  setStoredLocalUser(profile);
  return profile;
}

/**
 * Google sign-in.
 * 1. Android APK (Capacitor): tries CredentialManager first, then automatically falls back
 *    to legacy GoogleSignInIntent if CredentialManager fails on the device.
 * 2. Web browser: tries Firebase signInWithPopup.
 * 3. If Android SHA-1 / google-services.json or WebView blocks OAuth, signals the UI to
 *    present the in-app Google Account Sign-In sheet so the user is never blocked.
 */
export async function signInWithGoogle(): Promise<{
  user: AppUser | null;
  needsFallbackModal?: boolean;
  errorMessage?: string;
}> {
  if (Capacitor.isNativePlatform()) {
    let nativeResult: any = null;
    let lastNativeError: any = null;

    // Attempt 1: Android CredentialManager
    try {
      nativeResult = await FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: true,
        skipNativeAuth: true,
      });
    } catch (err1: any) {
      lastNativeError = err1;
      const msg1 = String(err1?.message || err1 || '').toLowerCase();
      const isUserCanceled =
        msg1.includes('cancel') && !msg1.includes('no credential') && !msg1.includes('developer');

      if (!isUserCanceled) {
        // Attempt 2: Classic GoogleSignInClient Intent (works on Xiaomi/HyperOS/MIUI when CredentialManager fails)
        try {
          nativeResult = await FirebaseAuthentication.signInWithGoogle({
            useCredentialManager: false,
            skipNativeAuth: true,
          });
        } catch (err2: any) {
          lastNativeError = err2;
        }
      } else {
        return { user: null };
      }
    }

    if (nativeResult) {
      const idToken = nativeResult.credential?.idToken;
      const accessToken = nativeResult.credential?.accessToken;

      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const credResult = await signInWithCredential(auth, credential);
          const mapped: AppUser = {
            uid: credResult.user.uid,
            displayName:
              credResult.user.displayName ||
              nativeResult.user?.displayName ||
              credResult.user.email?.split('@')[0] ||
              'User',
            email: credResult.user.email || nativeResult.user?.email || null,
            photoURL: credResult.user.photoURL || nativeResult.user?.photoUrl || null,
          };
          setStoredLocalUser(mapped);
          return { user: mapped };
        } catch {
          // If Firebase JS SDK rejects the token, still honor the native Google account
        }
      }

      if (nativeResult.user) {
        const mapped: AppUser = {
          uid: nativeResult.user.uid || `google-${Date.now()}`,
          displayName:
            nativeResult.user.displayName ||
            nativeResult.user.email?.split('@')[0] ||
            'Google User',
          email: nativeResult.user.email || null,
          photoURL: nativeResult.user.photoUrl || null,
        };
        setStoredLocalUser(mapped);
        return { user: mapped };
      }
    }

    // Native sign-in failed (e.g. SHA-1 mismatch 10:, missing google-services, or Play Services error)
    const errMsg = String(lastNativeError?.message || lastNativeError || 'Native Google Sign-In unavailable');
    return {
      user: null,
      needsFallbackModal: true,
      errorMessage: errMsg,
    };
  }

  // Web / PWA environment
  try {
    const popupResult = await signInWithPopup(auth, googleProvider);
    const mapped: AppUser = {
      uid: popupResult.user.uid,
      displayName:
        popupResult.user.displayName || popupResult.user.email?.split('@')[0] || 'User',
      email: popupResult.user.email,
      photoURL: popupResult.user.photoURL,
    };
    setStoredLocalUser(mapped);
    return { user: mapped };
  } catch (webErr: any) {
    const code = String(webErr?.code || webErr?.message || '');
    if (
      code.includes('popup-closed-by-user') ||
      code.includes('cancelled-popup-request')
    ) {
      return { user: null };
    }
    return {
      user: null,
      needsFallbackModal: true,
      errorMessage: code,
    };
  }
}

export async function signOut(authInstance: typeof auth) {
  setStoredLocalUser(null);
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (error) {
      console.warn('Native sign-out failed:', error);
    }
  }
  try {
    await firebaseSignOut(authInstance);
  } catch {
    // ignore if not signed into Firebase JS SDK
  }
}

export { signInWithPopup, onAuthStateChanged };