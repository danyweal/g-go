// lib/firebase.ts (client-only helpers)
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!, // e.g. "pcnw-app.appspot.com"
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _auth: Auth | undefined;
let _storage: FirebaseStorage | undefined;

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("lib/firebase.ts is client-only. Import it only in browser components/hooks.");
  }
}

export function getClientApp(): FirebaseApp {
  assertBrowser();
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getDb(): Firestore {
  assertBrowser();
  if (!_db) _db = getFirestore(getClientApp());
  return _db;
}

export function getAuthClient(): Auth {
  assertBrowser();
  if (!_auth) _auth = getAuth(getClientApp());
  return _auth;
}

export function getStorageClient(): FirebaseStorage {
  assertBrowser();
  if (!_storage) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    _storage = bucket ? getStorage(getClientApp(), `gs://${bucket}`) : getStorage(getClientApp());
  }
  return _storage;
}

/** Ensure there is a signed-in user (anonymous is fine). */
export function ensureAnonymousAuth(
  callback: (user: User | null) => void,
  onError?: (error: unknown) => void
) {
  assertBrowser();
  const auth = getAuthClient();
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) return void callback(user);
    signInAnonymously(auth)
      .then((cred) => callback(cred.user ?? null))
      .catch((err) => {
        console.error("Anonymous sign-in failed:", err);
        onError?.(err);
        callback(null);
      });
  });
  return unsub;
}
