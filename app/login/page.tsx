"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-orange-600/10 blur-[130px] rounded-full" />
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] border-4 border-orange-500/50 text-center max-w-md w-full shadow-2xl relative z-10">
      <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/20"><AlertTriangle size={40} /></div>
      <h1 className="text-2xl font-black mb-4 text-white italic tracking-tight">系統維護中</h1>
      <p className="text-slate-400 font-bold mb-10 leading-relaxed text-sm">TerryEdu 目前正在進行核心升級。<br/>為了確保數據安全，暫時關閉存取權限。</p>
      <div className="py-2.5 px-8 bg-slate-800/50 rounded-full inline-flex items-center gap-2 border border-slate-700">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Maintenance Active</span>
      </div>
    </motion.div>
  </div>
);

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (mSnap.exists() && mSnap.data().active) setIsMaintenance(true);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    checkStatus();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) router.push(snap.data().role === "teacher" ? "/admin" : "/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(20,184,166,0.3)]" />
    </div>
  );

  if (isMaintenance) return <MaintenanceScreen />;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/20 blur-[130px] rounded-full" />
        <motion.div animate={{ x: [0, -80, 0], y: [0, 60, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[15%] -right-[15%] w-[70%] h-[70%] bg-teal-600/20 blur-[150px] rounded-full" />
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-slate-800/50 max-w-sm w-full relative z-10">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-10 shadow-2xl">T</div>
        <h1 className="text-3xl font-black text-white mb-3 italic tracking-tighter">TerryEdu</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-12">Homework Solutions</p>
        <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-4">
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" /> Google 帳號登入
        </button>
      </motion.div>
    </div>
  );
}
