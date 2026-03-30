"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, UserCheck, ChevronRight, LogOut, Search, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // 綁定狀態管理
  const [showBinding, setShowBinding] = useState(false);
  const [seatNumber, setSeatNumber] = useState("");
  const [confirmingStudent, setConfirmingStudent] = useState<any>(null); // 用於暫存查詢到的學生資料
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
            if (data.role === "teacher") router.push("/admin");
            else if (data.seat_number) router.push("/dashboard");
            else setShowBinding(true);
          } else {
            setShowBinding(true);
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

  // 🚀 第一階段：查詢座號與姓名
  const handleLookupName = async () => {
    if (!seatNumber) return;
    try {
      const studentSnap = await getDoc(doc(db, "students", seatNumber.toString()));
      if (!studentSnap.exists()) {
        alert("❌ 找不到此座號，請檢查是否有誤。");
        return;
      }
      const sData = studentSnap.data();
      if (sData.bound_uid) {
        alert("⚠️ 此座號已被綁定！若有誤請洽老師。");
        return;
      }
      setConfirmingStudent({ id: studentSnap.id, ...sData });
    } catch (e) { alert("查詢失敗"); }
  };

  // 🚀 第二階段：確認無誤後正式綁定
  const handleFinalBind = async () => {
    if (!confirmingStudent || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await Promise.all([
        setDoc(doc(db, "users", user.uid), {
          role: "student",
          seat_number: Number(confirmingStudent.id),
          email: user.email,
          name: confirmingStudent.name
        }, { merge: true }),
        updateDoc(doc(db, "students", confirmingStudent.id), {
          bound_uid: user.uid,
          bound_email: user.email,
          photo_url: user.photoURL
        })
      ]);
      alert(`🎉 綁定成功！歡迎回來，${confirmingStudent.name}。`);
      router.push("/dashboard");
    } catch (e) { 
      alert("綁定失敗，請聯繫老師。"); 
      setIsSubmitting(false); 
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center transition-colors">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(20,184,166,0.3)]" />
    </div>
  );

  if (isMaintenance && !showBinding) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 transition-colors">
      <div className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] border-4 border-orange-500 text-center max-w-md w-full shadow-2xl relative">
        <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/20"><AlertTriangle size={40} /></div>
        <h1 className="text-2xl font-black mb-4 text-white italic tracking-tight">系統維護中</h1>
        <p className="text-slate-400 font-bold mb-10 leading-relaxed text-sm">目前關閉存取權限，請等候通知。</p>
        <div className="py-2.5 px-6 bg-slate-800 rounded-full inline-block"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest tracking-[0.3em]">Maintenance Active</span></div>
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
        {showBinding ? (
          <motion.div key="binding" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] border border-white/10 text-center max-w-sm w-full relative z-10 shadow-2xl">
            <div className="w-20 h-20 bg-teal-500/20 text-teal-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><UserCheck size={36} /></div>
            
            {!confirmingStudent ? (
              <>
                <h2 className="text-2xl font-black text-white mb-2 italic">身分綁定</h2>
                <p className="text-slate-400 text-xs font-bold mb-10 px-4">請輸入您的座號進行身分核對</p>
                <div className="space-y-6">
                  <input type="number" value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} placeholder="您的座號" className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-black text-xl outline-none focus:border-teal-500/50 transition-all placeholder:text-slate-700" />
                  <button onClick={handleLookupName} className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-50 transition-all active:scale-95"><Search size={18}/> 查詢姓名</button>
                </div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-8">
                  <h2 className="text-xl font-black text-white mb-4 italic">您是這位同學嗎？</h2>
                  <div className="py-8 px-4 bg-teal-500/10 rounded-[2.5rem] border border-teal-500/20 mb-4">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">座號 {confirmingStudent.id} 的姓名為：</p>
                    <p className="text-3xl font-black text-teal-400 tracking-tight">{confirmingStudent.name}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleFinalBind} disabled={isSubmitting} className="w-full bg-teal-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                    {isSubmitting ? "正在綁定..." : "是的，這是我"} <CheckCircle2 size={18}/>
                  </button>
                  <button onClick={() => setConfirmingStudent(null)} className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-2xl text-xs transition-colors hover:text-white">座號填錯了，重新輸入</button>
                </div>
              </motion.div>
            )}
            <button onClick={() => signOut(auth)} className="text-slate-600 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors flex items-center justify-center gap-2 mx-auto mt-8 transition-colors"><LogOut size={12}/> 取消登入</button>
          </motion.div>
        ) : (
          <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-3xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-slate-800/50 max-w-sm w-full relative z-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-10 shadow-2xl shadow-indigo-600/30">T</div>
            <h1 className="text-3xl font-black text-white mb-3 italic tracking-tighter">TerryEdu</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-12">Homework Solutions</p>
            <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-4 active:scale-95">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" /> Google 帳號登入
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
{/* 🚀 V2 審查修復：首頁用途說明與隱私權連結 */}
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-5">
            <div className="px-2">
              <h3 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mb-3">
                應用程式用途說明 (App Purpose)
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-bold">
                TerryEdu 是專為校內國二學生設計的個人化學習平台。我們透過 Google OAuth 驗證您的身分，以確保教學資源僅限授權學生存取，並提供解答共享、進度追蹤及筆記管理功能。
              </p>
            </div>
            
            {/* 🔗 關鍵：確保連結在首頁清晰可見 */}
            <div className="flex justify-center items-center gap-5">
              <a 
                href="/privacy" 
                className="text-[11px] font-black text-teal-600 dark:text-teal-400 hover:text-teal-500 underline underline-offset-4 decoration-2 transition-all"
              >
                隱私權政策 (Privacy Policy)
              </a>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                © 2026 TerryEdu Project
              </span>
            </div>
          </div>
