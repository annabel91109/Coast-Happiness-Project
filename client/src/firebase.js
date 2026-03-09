import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

// TODO: Replace these values with your Firebase project config.
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or select an existing one)
// 3. Go to Project Settings → General → Your apps → Add app (Web)
// 4. Copy the firebaseConfig object here
// 5. In Firebase console → Authentication → Sign-in method, enable:
//    - Email/Password
//    - Google
//    - Apple (requires Apple Developer account)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
