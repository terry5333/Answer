"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, writeBatch, 
  increment, serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, AlertTriangle, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";

// 🚀 1. 華麗的載入組件 (轉圈圈)
const LoadingScreen = () => (
  <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-500">
    <div className="relative">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
        className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full" 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1] }} 
        transition={{ repeat: Infinity, duration: 2 }} 
        className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full" 
      />
    </div>
    <p className="mt-6 text-slate-400 font-black italic tracking-[0.3em] text-xs uppercase animate-pulse"> TerryEdu Loading... </p>
  </div>
);

// 🚀 2. 質感維護畫面 (無按鈕)
const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 transition-colors duration-500">
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-orange-500/10 blur-[120px] rounded-full" />
    </div>
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] shadow-2xl border border-white dark:border-slate-800 text-center max-w-md w-full relative z-10"
    >
      <div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-orange-500/20">
        <AlertTriangle size={40} />
      </div>
      <h1 className="text-2xl font-black mb-4 text-slate-800 dark:text-slate-100 italic">系統維護中</h1>
      <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 leading-relaxed text-sm">
        TerryEdu 正在進行功能優化。<br/>維護期間暫時關閉所有存取權限，<br/>請等候老師通知開放。
      </p>
      <div className="py-2.5 px-8 bg-slate-100 dark:bg-slate-800 rounded-full inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700">
        <ShieldCheck size={14} className="text-orange-500" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maintenance Active</span>
      </div>
    </motion.div>
  </div>
);

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 30, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const [userSnap, mSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "settings", "maintenance"))
        ]);

        if (!userSnap.exists() || !userSnap.data().seat_number) {
          alert("⚠️ 請先完成身分綁定！"); router.push("/login"); return;
        }

        const isTeacher = userSnap.data().role === "teacher";
        const seatNumber = userSnap.data().seat_number;

        // 🚀 維護模式檢查
        if (mSnap.exists() && mSnap.data().active && !isTeacher) {
          const testers = mSnap.data().testers || [];
          if (!testers.includes(seatNumber)) {
            setIsMaintenanceMode(true);
            setLoading(false);
            return;
          }
        }

        const studentSnap = await getDoc(doc(db, "students", String(seatNumber)));
        setUserData({ ...userSnap.data(), name: studentSnap.exists() ? studentSnap.data().name : userSnap.data().name });
        const solSnap = await getDocs(collection(db, "solutions"));
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleViewSolution = async (sol: any) => {
    if (!userData) return;
    const targetUrl = sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : (sol.drive_file_id ? `https://drive.google.com/file/d/${sol.drive_file_id}/preview` : "");
    if (!targetUrl) { alert("此解答路徑失效"); return; }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "solutions", sol.id), { view_count: increment(1) });
      batch.set(doc(collection(db, "view_logs")), {
        student_uid: auth.currentUser?.uid, seat_number: userData.seat_number, solution_id: sol.id, viewed_at: serverTimestamp()
      });
      await batch.commit();
      setViewingPreviewUrl(targetUrl);
    } catch (e) { console.error(e); }
  };

  // 華麗的載入狀態
  if (loading) return <LoadingScreen />;
  
  // 維護模式攔截
  if (isMaintenanceMode) return <MaintenanceScreen />;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 pb-20 relative overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-500">
      
      {/* 磨砂玻璃背景特效 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 80, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-teal-100/30 dark:bg-indigo-900/20 blur-[120px] rounded-full" />
        <motion.div animate={{ x: [0, -100, 0], y: [0, 80, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} 
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-100/30 dark:bg-teal-900/20 blur-[150px] rounded-full" />
      </div>

      {!isVerified ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="min-h-[80vh] flex items-center justify-center">
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-white/50 dark:border-slate-800 max-w-sm w-full">
            <h1 className="text-xl font-black mb-8 text-indigo-900 dark:text-indigo-300 flex items-center justify-center gap-2 tracking-tighter"><ShieldCheck className="w-6 h-6" /> 安全身份驗證</h1>
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
        </motion.div>
      ) : (
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          
          {/* Header Bar */}
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-5 md:p-7 flex justify-between items-center shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20"><BookOpen className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-black tracking-tighter italic">TerryEdu</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Solutions Hall</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {mounted && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} 
                  className="w-11 h-11 rounded-full bg-white/50 dark:bg-slate-800 border border-white dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-sm"
                >
                  {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </motion.button>
              )}
              <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 pr-5 rounded-full border border-white dark:border-slate-700 transition-all">
                <img src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-600 shadow-sm" referrerPolicy="no-referrer" />
                <span className="font-black text-sm">{userData?.seat_number} 號 {userData?.name}</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { signOut(auth); router.push("/login"); }} className="ml-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></motion.button>
              </div>
            </div>
          </motion.div>

          {/* Subject Filter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex justify-start px-2">
            <div className="relative group">
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} 
                className="appearance-none bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white dark:border-slate-700/50 rounded-full px-10 py-4 font-black outline-none shadow-lg cursor-pointer text-sm dark:text-slate-200 min-w-[180px] hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                <option value="全部">🔍 全部科目</option>
                {Array.from(new Set(solutions.map(s => s.subject))).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-teal-500 transition-colors"><ChevronRight size={16} className="rotate-90" /></div>
            </div>
          </motion.div>

          {/* Solution Grid (With Staggered Animation) */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
              <motion.div key={sol.id} variants={itemVariants} whileHover={{ y: -8, scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleViewSolution(sol)} 
                className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 md:p-10 rounded-[3rem] border border-white dark:border-slate-800/50 shadow-xl hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2.5 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="text-[10px] text-teal-600 dark:text-teal-400 font-black mb-4 tracking-[0.2em] uppercase bg-teal-50 dark:bg-teal-500/10 self-start px-4 py-1.5 rounded-full w-fit">{sol.subject}</div>
                    <h3 className="font-black text-xl md:text-2xl text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{sol.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-12">
                    <div className="flex items-center gap-2.5 text-slate-400 font-bold text-xs"><FileText size={14} /> PDF 解答</div>
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-all shadow-inner"><ChevronRight size={20} /></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* 🚀 質感 PDF 預覽視窗 */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingPreviewUrl(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} 
              className="bg-white dark:bg-slate-900 rounded-t-[3.5rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[90vh] flex flex-col overflow-hidden shadow-2xl relative z-10 border border-transparent dark:border-slate-800"
            >
              <div className="p-6 md:p-9 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-50 dark:bg-teal-500/10 rounded-2xl"><BookOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" /></div>
                  <div>
                    <span className="font-black text-lg text-slate-800 dark:text-slate-100 italic">正在查閱解答</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Security Preview Mode</p>
                  </div>
                </div>
                <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setViewingPreviewUrl(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:text-slate-300 rounded-full font-bold transition-all shadow-sm">✕</motion.button>
              </div>
              <div className="flex-1 w-full bg-slate-200 dark:bg-slate-950 transition-colors">
                <iframe src={viewingPreviewUrl} className="w-full h-full border-none" allow="autoplay" title="PDF Preview" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark ::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
}
