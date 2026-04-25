import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Use hardcoded config to ensure it works in production
const firebaseConfig = {
  apiKey: "AIzaSyCdLfEPB7AlmbPPhs4qG_nn-naEZqSKtIM",
  authDomain: "business-ai-assistant-bc6b6.firebaseapp.com",
  projectId: "business-ai-assistant-bc6b6",
  storageBucket: "business-ai-assistant-bc6b6.firebasestorage.app",
  messagingSenderId: "1061030245654",
  appId: "1:1061030245654:web:ab62529168c791d69bcc37",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);