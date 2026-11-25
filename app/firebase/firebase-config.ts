// Your web app's Firebase configuration
export const firebaseConfig = {
  projectId: "fir-extendedfriendlymeals",
  appId: "1:859012197865:web:299d53bb34d66283ba6f78",
  storageBucket: "fir-extendedfriendlymeals.firebasestorage.app",
  apiKey: "AIzaSyC1fV0yBkTJoAiAzwdaosb40lODtbiyyHk",
  authDomain: "fir-extendedfriendlymeals.firebaseapp.com",
  messagingSenderId: "859012197865",
  measurementId: "G-0X45L0CEHT"
};

if (!firebaseConfig) {
  throw new Error('No firebase config found. Set the firebaseConfig object in firebase-config.ts');
}
