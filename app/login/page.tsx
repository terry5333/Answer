"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, UserCheck, ChevronRight, LogOut } from "lucide-react";

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showBinding, setShowBinding] = useState(false);
  const [seatNumber, setSeatNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const mSnap = await getDoc(doc(db, "settings", "maintenance"));
        if (mSnap.exists() && mSnap.data().active) setIsMaintenance(true);
      } catch (e) { console.error(e); }

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          const userSnap = await getDoc(doc(db, "users", currentUser.uid));
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.role === "teacher") {
              router.push("/admin");
            } else if (data.seat_number) {
              router.push("/dashboard");
            } else {
              setShowBinding(true); // 已登入但沒座號
            }
          } else {
            setShowBinding(true); // 新用戶
          }
        } else {
          setUser(null);
          setShowBinding(false);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    };
    checkStatus();
  }, [router]);

  // 🚀 核心功能：學生自行綁定座號
  const handleBindSeat = async () => {
    if (!seatNumber || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const seatId = seatNumber.toString();
      const studentRef = doc(db, "students", seatId);
      const studentSnap = await getDoc(studentRef);

      // 1. 檢查該座號是否存在
      if (!studentSnap.exists()) {
        alert("找不到此座號，請確認輸入是否正確。");
        setIsSubmitting(false);
        return;
      }

      // 2. 檢查該座號是否已被綁定
      if (studentSnap.data().bound_uid) {
        alert("此座號已被其他帳號綁定！若有誤請洽老師。");
        setIsSubmitting(false);
        return;
      }

      // 3. 執行雙向綁定
      await Promise.all([
        setDoc(doc(db, "users", user.uid), {
          role: "student",
          seat_number: Number(seatNumber),
          email: user.email,
          name: studentSnap.data().name
        }, { merge: true }),
        updateDoc(studentRef, {
          bound_uid: user.uid,
          bound_email: user.email,
          photo_url: user.photoURL
        })
      ]);

      alert("🎉 綁定成功！即將進入解答大廳");
      router.push("/dashboard");
    } catch (e) {
      alert("綁定失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center transition-colors">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(20,184,166,0.3)]" />
    </div>
  );

  // 維護畫面 (若開啟維護，且不是老師，就不能進行綁定)
  if (isMaintenance && !showBinding) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] border-4 border-orange-500 text-center max-w-md w-full shadow-2xl">
        <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8"><AlertTriangle size={40} /></div>
        <h1 className="text-2xl font-black mb-4 text-white italic">系統維護中</h1>
        <p className="text-slate-400 font-bold mb-10 text-sm">目前關閉存取權限，請等候通知。</p>
        <div className="py-2.5 px-6 bg-slate-800 rounded-full inline-block"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest tracking-[0.3em]">Maintenance</span></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* 磨砂玻璃背景特效 */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full" />
        <div className="absolute -bottom-[15%] -right-[15%] w-[70%] h-[70%] bg-teal-600/10 blur-[150px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {showBinding ? (
          // 🚀 學生自己選座號的介面
          <motion.div key="binding" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] border border-white/10 text-center max-w-sm w-full relative z-10 shadow-2xl">
            <div className="w-20 h-20 bg-teal-500/20 text-teal-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><UserCheck size={36} /></div>
            <h2 className="text-2xl font-black text-white mb-2 italic">初次登入</h2>
            <p className="text-slate-400 text-xs font-bold mb-10 px-4">請輸入您的座號完成身分綁定</p>
            
            <div className="space-y-6">
              <div className="relative group">
                <input 
                  type="number" 
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  placeholder="您的座號 (例如: 7)" 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-black text-xl outline-none focus:border-teal-500/50 transition-all placeholder:text-slate-700"
                />
              </div>

              <button 
                onClick={handleBindSeat}
                disabled={!seatNumber || isSubmitting}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? "綁定中..." : "完成綁定"} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button onClick={() => signOut(auth)} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors flex items-center justify-center gap-2 mx-auto mt-4"><LogOut size={12}/> 使用其他帳號登入</button>
            </div>
          </motion.div>
        ) : (
          // 標準登入按鈕
          <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-slate-800/50 max-w-sm w-full relative z-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-10 shadow-2xl">T</div>
            <h1 className="text-3xl font-black text-white mb-3 italic tracking-tighter">TerryEdu</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-12">Homework Solutions</p>
            <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-4">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" /> Google 帳號登入
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
