
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// --- URGENT: PASTE YOUR FIREBASE CONFIGURATION HERE ---
// Find these values in your Firebase project settings under "General".
const firebaseConfig = {
  apiKey: "AIzaSyDC5PpahjVXu4L8GPb9C04k0k78hq5IVkk",
  authDomain: "transcript-studio-4drhv.appspot.com",
  projectId: "transcript-studio-4drhv",
  storageBucket: "transcript-studio-4drhv.appspot.com",
  messagingSenderId: "371403164462",
  appId: "1:371403164462:web:1bac6e64e9f8e48d8308bf"
};
// --- END OF CONFIGURATION SECTION ---


// Initialize Firebase App safely, preventing re-initialization on hot reloads.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
