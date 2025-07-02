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

// Add a console log to see what the browser is receiving.
if (typeof window !== 'undefined') {
  console.log("Firebase Config Loaded by Browser:", firebaseConfig);

  // A non-crashing check
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.storageBucket
  ) {
    console.error(
      'CRITICAL: Firebase configuration is missing or incomplete. This will cause app failures. Check that your .env.local file is in the project root and the dev server has been restarted.'
    );
  }
}

// Initialize Firebase App safely, preventing re-initialization on hot reloads.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
