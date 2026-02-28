"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, UserPlus, Copy, LogOut } from "lucide-react";

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unboundUser, setUnboundUser] = useState<{ uid: string; email: string | null } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (mSnap.exists() && mSnap.data().active) setIsMaintenance(true);
      } catch (e) { console.error(e); }
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.role === "teacher") {
              router.push("/admin");
            } else if (data.seat_number) {
              router.push("/dashboard");
            } else {
              // 已登入但「無座號」的情境
              setUnboundUser({ uid: user.uid, email: user.email });
            }
          } else {
            // 完全沒紀錄的新帳號
            setUnboundUser({ uid: user.uid, email: user.email });
          }
        } else {
          setUnboundUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    };
    checkStatus();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );

  // 維護畫面
  if (isMaintenance && !unboundUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] border-4 border-orange-500 text-center max-w-md w-full shadow-2xl">
        <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl"><AlertTriangle size={40} /></div>
        <h1 className="text-2xl font-black mb-4 text-white italic">系統維護中</h1>
        <p className="text-slate-400 font-bold mb-10 text-sm">TerryEdu 目前暫停開放存取。</p>
        <div className="py-2.5 px-6 bg-slate-800 rounded-full inline-block"><span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Maintenance</span></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full" />
        <div className="absolute -bottom-[15%] -right-[15%] w-[70%] h-[70%] bg-teal-600/10 blur-[150px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {unboundUser ? (
          // 🚀 核心修復：顯示 UID 給學生截圖，防止跳轉迴圈
          <motion.div key="unbound" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/60 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/10 text-center max-w-sm w-full relative z-10">
            <div className="w-16 h-16 bg-teal-500/20 text-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><UserPlus size={32} /></div>
            <h2 className="text-xl font-black text-white mb-2">等待身分綁定</h2>
            <p className="text-slate-400 text-xs font-bold mb-8 px-4">您的帳號已登入，但尚未關聯座號。請提供以下 UID 給老師進行綁定：</p>
            
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-8 group relative">
              <code className="text-teal-400 text-[10px] break-all font-mono">{unboundUser.uid}</code>
              <button onClick={() => { navigator.clipboard.writeText(unboundUser.uid); alert("UID 已複製"); }} className="absolute right-2 bottom-2 p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><Copy size={12} /></button>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.reload()} className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl text-sm shadow-xl">完成綁定了，點我刷新</button>
              <button onClick={() => signOut(auth)} className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 mt-2"><LogOut size={14}/> 切換帳號</button>
            </div>
          </motion.div>
        ) : (
          // 標準登入畫面
          <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-slate-800/50 max-w-sm w-full relative z-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-10 shadow-2xl">T</div>
            <h1 className="text-3xl font-black text-white mb-3 italic tracking-tighter">TerryEdu</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-12">Homework Solutions</p>
            <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-4">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" /> 透過 Google 登入
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
