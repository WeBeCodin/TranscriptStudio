// This is a comment to ensure the file is changed.
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Construct the configuration object from environment variables.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Runtime validation to ensure all required client-side variables are present.
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket
) {
  throw new Error(
    'Firebase configuration is missing or incomplete. Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly.'
  );
}

// Initialize Firebase App safely, preventing re-initialization on hot reloads.
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
