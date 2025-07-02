import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// --- URGENT: .env variables are not loading. Using hardcoded values as a temporary fix. ---
// You must replace these placeholders with your actual Firebase project configuration.
// You can find these values in your Firebase project settings.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE", // Replace with your Firebase API Key
  authDomain: "YOUR_AUTH_DOMAIN_HERE", // e.g., your-project-id.firebaseapp.com
  projectId: "transcript-studio-4drhv",
  storageBucket: "transcript-studio-4drhv.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE",
};

// On the client-side, log the configuration that is being used to help with debugging.
if (typeof window !== 'undefined') {
  console.log('Firebase Config being used for initialization:', firebaseConfig);
  if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE" || !firebaseConfig.apiKey) {
    console.error("Firebase config is using placeholder values. Please replace them in src/lib/firebase.ts");
    alert("CRITICAL: Firebase is not configured. Please add your project credentials to src/lib/firebase.ts");
  }
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
