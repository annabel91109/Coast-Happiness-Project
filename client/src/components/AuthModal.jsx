import { useState } from "react";
import { auth, googleProvider, appleProvider } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useLang } from "../LangContext";
import { T } from "../i18n";

export default function AuthModal({ onClose }) {
  const { lang } = useLang();
  const t = T[lang];
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function friendlyError(code) {
    const map = {
      "auth/user-not-found": t.auth.errNotFound,
      "auth/wrong-password": t.auth.errWrongPassword,
      "auth/email-already-in-use": t.auth.errEmailInUse,
      "auth/weak-password": t.auth.errWeakPassword,
      "auth/invalid-email": t.auth.errInvalidEmail,
      "auth/popup-closed-by-user": null,
      "auth/cancelled-popup-request": null,
    };
    return map[code] ?? t.auth.errGeneric;
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err) {
      const msg = friendlyError(err.code);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider) {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err) {
      const msg = friendlyError(err.code);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-[#145e6a]">
            {mode === "signin" ? t.auth.signIn : t.auth.createAccount}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3 mb-4">
          <button
            onClick={() => handleOAuth(googleProvider)}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {t.auth.continueWithGoogle}
          </button>

          <button
            onClick={() => handleOAuth(appleProvider)}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {/* Apple logo */}
            <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="white">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-43.4-150.3-99.8C27.8 653.1 0 545.5 0 441.8c0-207.3 135.3-316.7 269.2-316.7 71 0 130.5 46.4 174.9 46.4 42.8 0 109.7-49.1 192.5-49.1 30.8 0 108.2 2.6 168.6 75.8z"/>
              <path d="M554.3 55.7c20.1-24.4 34.4-58.2 34.4-91.9 0-4.5-.4-9.1-1.3-12.8-32.5 1.3-71.2 21.8-94.4 49.2C476 23.5 459.8 57.7 459.8 91.5c0 4.5.6 9.1 1.3 10.4 2 .4 5.2.6 8.4.6 29.2 0 65.4-19.5 84.8-46.8z"/>
            </svg>
            {t.auth.continueWithApple}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400">{t.auth.or}</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#145e6a] transition-colors"
          />
          <input
            type="password"
            required
            placeholder={t.auth.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#145e6a] transition-colors"
          />
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#145e6a] text-white text-sm font-medium rounded-xl hover:bg-[#0e4a54] transition-colors disabled:opacity-50"
          >
            {loading ? t.auth.loading : (mode === "signin" ? t.auth.signIn : t.auth.createAccount)}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-xs text-gray-500 mt-4">
          {mode === "signin" ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="text-[#145e6a] font-medium hover:underline"
          >
            {mode === "signin" ? t.auth.createOne : t.auth.signInLink}
          </button>
        </p>
      </div>
    </div>
  );
}
