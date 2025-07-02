
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// --- URGENT: PASTE YOUR FIREBASE CONFIGURATION HERE ---
// This is a temporary but necessary workaround because the .env.local file is not being loaded.
// Find these values in your Firebase project settings under "General".
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};
// --- END OF CONFIGURATION SECTION ---


// Initialize Firebase App safely, preventing re-initialization on hot reloads.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
