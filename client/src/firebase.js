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
  apiKey: "AIzaSyBpeHjDH-S9zckNNajQ76AgFRertz_1glk",
  authDomain: "coast-happiness-project.firebaseapp.com",
  projectId: "coast-happiness-project",
  storageBucket: "coast-happiness-project.firebasestorage.app",
  messagingSenderId: "290674681777",
  appId: "1:290674681777:web:4333138fb1355dc24a7f90",
  measurementId: "G-P6HT3W2231",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
