"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";

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
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { name: result.user.displayName, email: result.user.email, role: "student", seat_number: null, created_at: new Date() });
      }
    } catch (error) { console.error(error); setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden transition-colors">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-teal-400/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 md:p-12 rounded-[3rem] shadow-2xl border border-white dark:border-slate-800">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-xl mb-6">
              <BookOpen size={40} />
            </div>
            <h1 className="text-4xl font-black italic text-slate-800 dark:text-white mb-2">TerryEdu</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2"><GraduationCap size={14} /> 數位學習共享平台</p>
          </div>
          <button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border-2 py-4 rounded-full font-black text-slate-700 dark:text-slate-200 hover:border-teal-400 transition-all active:scale-95 shadow-sm">
            {isLoading ? <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /> : <span>使用 Google 帳號登入</span>}
          </button>
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-5">
            <div className="px-2">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">應用程式用途說明</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed font-bold">TerryEdu 為校內國二學生設計之個人化學習平台。我們透過 Google OAuth 驗證您的身分，以確保教學資源僅限授權學生存取，並提供解答共享與筆記管理功能。</p>
            </div>
            <div className="flex justify-center items-center gap-5">
              <a href="/privacy" className="text-[11px] font-black text-teal-600 hover:text-teal-500 underline underline-offset-4 decoration-2">隱私權政策</a>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-black text-slate-400 uppercase">© 2026 TerryEdu</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
