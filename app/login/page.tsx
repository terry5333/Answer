"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertTriangle, LogIn } from "lucide-react";

// 🚀 1. 質感維護阻擋畫面 (無按鈕)
const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-orange-600/10 blur-[130px] rounded-full" />
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] border-4 border-orange-500/50 text-center max-w-md w-full shadow-2xl relative z-10"
    >
      <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/20">
        <AlertTriangle size={40} />
      </div>
      <h1 className="text-2xl font-black mb-4 text-white italic tracking-tight">系統維護中</h1>
      <p className="text-slate-400 font-bold mb-10 leading-relaxed text-sm">
        TerryEdu 目前正在進行核心升級。<br/>為了確保數據安全，暫時關閉登入功能，<br/>請稍後再試或聯繫管理員。
      </p>
      <div className="py-2.5 px-8 bg-slate-800/50 rounded-full inline-flex items-center gap-2 border border-slate-700">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Under Construction</span>
      </div>
    </motion.div>
  </div>
);

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 🚀 2. 檢查系統維護狀態
    const checkStatus = async () => {
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (mSnap.exists() && mSnap.data().active) {
          setIsMaintenance(true);
        }
      } catch (e) { console.error("維護狀態讀取失敗:", e); }
      setLoading(false);
    };
    checkStatus();

    // 🚀 3. 已登入者自動跳轉
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

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      // 登入後由 onAuthStateChanged 處理跳轉
    } catch (e) {
      console.error("登入失敗:", e);
      alert("登入過程中發生錯誤，請稍後再試。");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div 
        animate={{ opacity: [0.3, 1, 0.3] }} 
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="text-white font-black italic tracking-[0.5em] text-sm uppercase"
      >
        TerryEdu
      </motion.div>
    </div>
  );

  // 🚀 如果維護中，顯示無按鈕畫面
  if (isMaintenance) return <MaintenanceScreen />;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* 🚀 背景磨砂玻璃光球 */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div 
          animate={{ x: [0, 60, 0], y: [0, 40, 0] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/20 blur-[130px] rounded-full" 
        />
        <motion.div 
          animate={{ x: [0, -80, 0], y: [0, 60, 0] }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[15%] -right-[15%] w-[70%] h-[70%] bg-teal-600/20 blur-[150px] rounded-full" 
        />
      </div>

      {/* 🚀 登入卡片 (Clean UI & Glassmorphism) */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] text-center shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] border border-slate-800/50 max-w-sm w-full relative z-10"
      >
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-10 shadow-2xl shadow-indigo-600/30">
          T
        </div>
        
        <div className="mb-12">
          <h1 className="text-3xl font-black text-white mb-3 italic tracking-tighter">TerryEdu</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Homework Solutions</p>
        </div>

        <div className="space-y-4">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin} 
            className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-4 group"
          >
            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-white transition-colors">
              <img src="https://www.google.com/favicon.ico" className="w-3.5 h-3.5" alt="google" />
            </div>
            <span className="text-sm">使用 Google 帳號登入</span>
          </motion.button>

          <p className="text-[10px] text-slate-600 font-bold px-4 leading-relaxed">
            登入即代表您同意遵守本平台的相關教學規範與使用聲明。
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800/50 flex justify-center gap-6">
           <div className="flex flex-col items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-slate-500 font-black uppercase">Server Online</span>
           </div>
        </div>
      </motion.div>

      {/* 底部裝飾文字 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] italic">Vibe Coded by Terry</span>
      </div>
    </div>
  );
}
