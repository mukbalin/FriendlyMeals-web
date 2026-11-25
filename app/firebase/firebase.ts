import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { firebaseConfig } from "./firebase-config";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { getStorage } from "firebase/storage";

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize App Check if configured with a valid reCAPTCHA key
// See http://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
const recaptchaKey = 'RECAPTCHA_KEY';
if (typeof window !== 'undefined' && recaptchaKey !== 'RECAPTCHA_KEY') {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey), 
    isTokenAutoRefreshEnabled: true
  });
}

// Initialize the Gemini Developer API backend service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

export const storage = getStorage(firebaseApp);

export { ai };
