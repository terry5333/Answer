"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, GraduationCap, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          router.push(role === "teacher" ? "/admin" : "/dashboard");
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          role: "student",
          seat_number: null,
          created_at: new Date()
        });
      }
      // 導向邏輯保持不變
    } catch (error) {
      console.error("登入失敗:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden transition-colors duration-500">
      {/* 動態背景裝飾 */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 10, repeat: Infinity }} className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-teal-400/10 blur-[120px] rounded-full" />
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 15, repeat: Infinity }} className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 md:p-12 rounded-[3rem] shadow-2xl border border-white dark:border-slate-800 transition-colors">
          
          {/* Logo 區塊 - 確保名稱 TerryEdu 清晰可見 */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-xl mb-6">
              <BookOpen size={40} />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-slate-800 dark:text-white mb-2">
              TerryEdu
            </h1>
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              <GraduationCap size={14} /> 數位學習共享平台
            </div>
          </div>

          {/* 登入按鈕 */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 text-slate-700 dark:text-slate-200 font-black py-4 rounded-full transition-all active:scale-95 shadow-sm"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>使用學校 Google 帳號登入</span>
              </>
            )}
          </button>

          {/* 🚀 V2 審查修復區塊：用途說明與隱私權連結 */}
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-5">
            <div className="px-2">
              <h3 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mb-3">
                應用程式用途說明 (App Purpose)
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-bold">
                TerryEdu 是專為校內國二學生設計的個人化學習平台。我們透過 Google OAuth 驗證您的身分，以確保教學資源僅限授權學生存取，並提供解答共享、進度追蹤及筆記管理功能。
              </p>
            </div>
            
            <div className="flex justify-center items-center gap-5">
              <a 
                href="/privacy" 
                className="text-[11px] font-black text-teal-600 dark:text-teal-400 hover:text-teal-500 underline underline-offset-4 decoration-2 transition-all"
              >
                隱私權政策 (Privacy Policy)
              </a>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-[10px] font-black text-slate-400 uppercase">
                © 2026 TerryEdu
              </span>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
