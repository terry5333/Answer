"use client";
import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (mSnap.exists() && mSnap.data().active) {
          setIsMaintenance(true);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    checkStatus();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          router.push(snap.data().role === "teacher" ? "/admin" : "/dashboard");
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black italic tracking-widest">TERRYEDU...</div>;

  // 🚀 維護模式封鎖畫面（無按鈕）
  if (isMaintenance) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="bg-slate-900 p-12 rounded-[3.5rem] border-4 border-orange-500 text-center max-w-md w-full shadow-2xl">
        <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><AlertTriangle size={40} /></div>
        <h1 className="text-2xl font-black mb-4 text-white italic">系統維護中</h1>
        <p className="text-slate-400 font-bold mb-6 text-sm leading-relaxed">TerryEdu 正在進行升級，目前關閉所有登入與存取權限。請等候老師通知。</p>
        <div className="py-2 px-6 bg-slate-800 rounded-full inline-block"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Maintenance Active</span></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 p-12 rounded-[3.5rem] text-center shadow-2xl border border-slate-800 max-w-sm w-full">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-8 shadow-lg">T</div>
        <h1 className="text-2xl font-black text-white mb-2 italic">TerryEdu</h1>
        <p className="text-slate-500 text-sm font-bold mb-10">請使用 Google 帳號登入系統</p>
        <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-slate-900 font-black py-4 rounded-full shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3">
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" /> Google 登入
        </button>
      </motion.div>
    </div>
  );
}
