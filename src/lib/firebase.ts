
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Construct the configuration object from environment variables.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Runtime validation to ensure all required client-side variables are present.
// This provides a clear error during development if the .env.local file is misconfigured.
if (
  typeof window !== 'undefined' &&
  (!firebaseConfig.apiKey ||
   !firebaseConfig.authDomain ||
   !firebaseConfig.projectId ||
   !firebaseConfig.storageBucket)
) {
  throw new Error(
    'Firebase configuration is missing or incomplete. Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly.'
  );
}

// Initialize Firebase App safely, preventing re-initialization on hot reloads.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
