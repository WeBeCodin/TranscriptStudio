
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// --- URGENT: .env variables are not loading. Using hardcoded values as a temporary fix. ---
// You must replace these placeholders with your actual Firebase project configuration.
// You can find these values in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyDC5PpahjVXu4L8GPb9C04k0k78hq5IVkk",
  authDomain: "transcript-studio-4drhv.firebaseapp.com",
  projectId: "transcript-studio-4drhv",
  storageBucket: "transcript-studio-4drhv.appspot.com",
  messagingSenderId: "371403164462",
  appId: "1:371403164462:web:1bac6e64e9f8e48d8308bf"
};

// On the client-side, log the configuration that is being used to help with debugging.
if (typeof window !== 'undefined') {
  console.log('Firebase Config being used for initialization:', firebaseConfig);
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
