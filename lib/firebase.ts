import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 從環境變數讀取 Firebase 金鑰 (Vercel 或 .env.local)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 💡 關鍵修復：Next.js 熱重載防呆機制
// 檢查是否已經有初始化的 app，如果沒有才 initializeApp，避免重複執行報錯
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 初始化 Auth 與 Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// 🚀 關鍵修復：建立並匯出 Google 登入的 Provider
const provider = new GoogleAuthProvider();

// 將它們統一匯出，讓整個系統都能乾淨地引用
export { app, auth, db, provider };
