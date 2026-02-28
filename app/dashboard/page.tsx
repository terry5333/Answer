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
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, AlertTriangle } from "lucide-react";
import { useTheme } from "next-themes";

// 🚀 維護模式專用的「無按鈕」極簡畫面
const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 transition-colors">
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border-4 border-orange-500 text-center max-w-md w-full"
    >
      <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
        <AlertTriangle size={40} />
      </div>
      <h1 className="text-2xl font-black mb-4 text-slate-800 dark:text-slate-100 italic">系統維護中</h1>
      <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 leading-relaxed text-sm">
        為了提供更優質的服務，TerryEdu 正在進行例行維護或功能升級。<br/>目前暫停開放，請等候老師通知。
      </p>
      <div className="py-2 px-6 bg-slate-100 dark:bg-slate-800 rounded-full inline-block">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maintenance Mode</span>
      </div>
    </motion.div>
  </div>
);

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 25, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 20 } } };

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  
  // 🚀 維護阻擋狀態
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      
      try {
        // 1. 取得使用者資料與維護狀態
        const [userSnap, maintenanceSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "settings", "maintenance"))
        ]);

        if (!userSnap.exists() || !userSnap.data().seat_number) {
          alert("⚠️ 請先完成身分綁定！"); router.push("/login"); return;
        }

        const isTeacher = userSnap.data().role === "teacher";
        const seatNumber = userSnap.data().seat_number;

        // 2. 維護模式判定邏輯
        if (maintenanceSnap.exists() && maintenanceSnap.data().active && !isTeacher) {
          const testers = maintenanceSnap.data().testers || [];
          // 如果學生座號不在測試員名單內，就啟動阻擋
          if (!testers.includes(seatNumber)) {
            setIsMaintenanceMode(true);
            setLoading(false);
            return;
          }
        }

        // 3. 正常存取流程
        const studentSnap = await getDoc(doc(db, "students", String(seatNumber)));
        setUserData({ 
          ...userSnap.data(), 
          name: studentSnap.exists() ? studentSnap.data().name : userSnap.data().name 
        });
        await fetchSolutions();
      } catch (e) {
        console.error("初始化失敗:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSolutions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "solutions"));
      setSolutions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
  };

  // 🚀 同時支援新版 GAS 網址與舊版 Google Drive ID 的預覽邏輯
  const handleViewSolution = async (sol: any) => {
    if (!userData) return;

    let targetUrl = "";
    if (sol.file_url) {
      targetUrl = sol.file_url.replace(/\/view.*/, "/preview"); // 新版 GAS
    } else if (sol.drive_file_id) {
      targetUrl = `https://drive.google.com/file/d/${sol.drive_file_id}/preview`; // 舊版 ID
    } else {
      alert("此解答檔案連結遺失。");
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "solutions", sol.id), { view_count: increment(1) });
      batch.set(doc(collection(db, "view_logs")), {
        student_uid: auth.currentUser?.uid, 
        seat_number: userData.seat_number, 
        solution_id: sol.id, 
        viewed_at: serverTimestamp()
      });
      await batch.commit();
      setViewingPreviewUrl(targetUrl);
    } catch (e) { console.error(e); }
  };

  const sortedSolutions = solutions
    .filter(s => selectedSubject === "全部" || s.subject === selectedSubject)
    .sort((a, b) => a.subject.localeCompare(b.subject, 'zh-TW'));

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center transition-colors">
      <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // 🚀 如果處於維護模式，渲染無按鈕畫面
  if (isMaintenanceMode) return <MaintenanceScreen />;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 pb-20 relative overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-500">
      
      {/* 磨砂玻璃背景特效 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} 
          className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-teal-100/30 dark:bg-indigo-900/20 blur-[100px] rounded-full" />
        <motion.div animate={{ x: [0, -40, 0], y: [0, 60, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-100/30 dark:bg-teal-900/20 blur-[120px] rounded-full" />
      </div>

      {!isVerified ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="min-h-[80vh] flex items-center justify-center">
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] text-center shadow-2xl border border-white dark:border-slate-700/50 max-w-sm w-full">
            <h1 className="text-xl font-black mb-6 text-indigo-900 dark:text-indigo-300 flex items-center justify-center gap-2"><BookOpen className="w-6 h-6" /> 安全驗證</h1>
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
        </motion.div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          
          {/* Header Bar */}
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-4 md:p-6 flex justify-between items-center shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 dark:bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><BookOpen className="w-5 h-5" /></div>
              <h1 className="text-lg md:text-xl font-black tracking-tight hidden sm:block">TerryEdu 解答大廳</h1>
              <h1 className="text-lg font-black tracking-tight sm:hidden">解答大廳</h1>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              {mounted && (
                <button 
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} 
                  className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800/80 border border-white dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-sm transition-colors"
                >
                  {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              )}

              <div className="flex items-center gap-2 md:gap-4 bg-white/50 dark:bg-slate-800/80 p-1.5 pr-4 rounded-full border border-white/50 dark:border-slate-700">
                <img src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-8 h-8 rounded-full border border-white dark:border-slate-600" referrerPolicy="no-referrer" />
                <span className="font-black text-xs md:text-sm text-slate-700 dark:text-slate-200">{userData?.seat_number} 號 {userData?.name}</span>
                <button onClick={() => { signOut(auth); router.push("/login"); }} className="ml-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
              </div>
            </div>
          </motion.div>

          {/* Subject Filter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="px-2">
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="appearance-none bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white dark:border-slate-700/50 rounded-full px-8 py-3.5 font-bold outline-none shadow-lg cursor-pointer text-sm dark:text-slate-200 transition-all">
              <option value="全部">🔍 全部科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </motion.div>

          {/* Solution Grid */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {sortedSolutions.map(sol => (
              <motion.div key={sol.id} variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleViewSolution(sol)} 
                className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-6 md:p-8 rounded-[3rem] border border-white dark:border-slate-700/50 shadow-lg hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="text-[10px] md:text-xs text-teal-600 dark:text-teal-400 font-black mb-3 tracking-[0.2em] uppercase bg-teal-50 dark:bg-teal-500/10 self-start px-3 py-1 rounded-full w-fit">{sol.subject}</div>
                    <h3 className="font-black text-lg md:text-xl text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">{sol.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-bold"><FileText size={12} /> PDF 解答</div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-all shadow-inner"><ChevronRight size={16} /></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* 解答預覽 Modal (移除外部連結按鈕) */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingPreviewUrl(null)} className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-lg" />
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} 
              className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-5xl h-[95vh] md:h-[85vh] flex flex-col overflow-hidden shadow-2xl relative z-10 border dark:border-slate-700/50"
            >
              <div className="p-5 md:p-8 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-500/10 rounded-xl"><BookOpen size={20} className="text-teal-600 dark:text-teal-400" /></div>
                  <span className="font-black text-base md:text-lg text-slate-800 dark:text-slate-100">正在查閱解答</span>
                </div>
                <button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:text-slate-300 rounded-full font-bold transition-all">✕</button>
              </div>
              <div className="flex-1 w-full bg-slate-200 dark:bg-slate-800 transition-colors">
                <iframe src={viewingPreviewUrl} className="w-full h-full border-none" allow="autoplay" title="PDF Preview" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
