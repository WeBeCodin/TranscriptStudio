import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // Hardcoding for debugging - if this works, the .env loading is the issue.
  projectId: "transcript-studio-4drhv",
  storageBucket: "transcript-studio-4drhv.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// On the client-side, log the configuration that is being used.
// This will help us debug if the .env variables are being loaded correctly.
if (typeof window !== 'undefined') {
  console.log('Firebase Config being used for initialization:', firebaseConfig);
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
