"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, AlertTriangle, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors">
    <div className="relative flex items-center justify-center">
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute w-24 h-24 bg-teal-500/20 blur-2xl rounded-full" />
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-800 rounded-full" />
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="absolute inset-0 border-4 border-teal-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(20,184,166,0.4)]" />
      </div>
    </div>
    <div className="mt-8 py-1.5 px-5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-white dark:border-slate-800 rounded-full"><span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">System Loading</span></div>
  </div>
);

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const [uSnap, mSnap] = await Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "settings", "maintenance"))]);
        
        if (!uSnap.exists() || !uSnap.data().seat_number) {
           router.push("/login"); return; 
        }

        const isT = uSnap.data().role === "teacher";
        const seat = uSnap.data().seat_number;
        
        // 維護模式攔截
        if (mSnap.exists() && mSnap.data().active && !isT && !(mSnap.data().testers || []).includes(seat)) { 
          setIsBlocked(true); setLoading(false); return; 
        }
        
        const sRef = doc(db, "students", String(seat));
        const sSnap = await getDoc(sRef);
        
        // 🚀 核心魔法：靜默比對與自動更新
        let currentPhotoUrl = user.photoURL;
        let currentName = user.displayName;
        let dbPhotoUrl = sSnap.exists() ? sSnap.data().photo_url : null;
        let dbName = sSnap.exists() ? sSnap.data().name : uSnap.data().name;

        // 如果發現 Google 的資料跟資料庫不一樣，就在背景偷偷更新
        if (sSnap.exists() && (dbPhotoUrl !== currentPhotoUrl || (currentName && dbName !== currentName))) {
          const finalName = currentName || dbName;
          updateDoc(sRef, { photo_url: currentPhotoUrl, name: finalName });
          updateDoc(doc(db, "users", user.uid), { name: finalName });
          
          dbPhotoUrl = currentPhotoUrl;
          dbName = finalName;
          console.log("🔄 已在背景自動同步最新大頭貼與姓名"); // 開發者彩蛋
        }

        setUserData({ ...uSnap.data(), name: dbName, photo_url: dbPhotoUrl });
        
        const solSnap = await getDocs(collection(db, "solutions"));
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <LoadingScreen />;
  if (isBlocked) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 transition-colors">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[3.5rem] shadow-2xl border border-white dark:border-slate-800 text-center max-w-md w-full relative z-10"><div className="w-20 h-20 bg-orange-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl"><AlertTriangle size={40} /></div><h1 className="text-2xl font-black mb-4 text-slate-800 dark:text-slate-100 italic">系統維護中</h1><p className="text-slate-500 dark:text-slate-400 font-bold mb-10 text-sm">請等候開放。</p></motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 pb-20 relative overflow-hidden transition-colors">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 80, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-teal-100/30 dark:bg-indigo-900/20 blur-[120px] rounded-full" />
        <motion.div animate={{ x: [0, -100, 0], y: [0, 80, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] bg-indigo-100/30 dark:bg-teal-900/20 blur-[150px] rounded-full" />
      </div>

      {!isVerified ? (
        <div className="min-h-[80vh] flex items-center justify-center"><div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl p-12 rounded-[3.5rem] text-center shadow-2xl border border-white/50 dark:border-slate-800 max-w-sm w-full"><h1 className="text-xl font-black mb-8 text-indigo-900 dark:text-indigo-300 flex items-center justify-center gap-2"><ShieldCheck /> 安全驗證</h1><Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} /></div></div>
      ) : (
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-6 md:p-8 flex justify-between items-center shadow-xl">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><BookOpen size={24} /></div><h1 className="text-xl font-black italic">TerryEdu</h1></div>
            <div className="flex items-center gap-3">
              {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-11 h-11 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm">{resolvedTheme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>}
              <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 pr-5 rounded-full border border-white dark:border-slate-700 transition-all">
                {/* 這裡直接吃上面處理好的 userData.photo_url */}
                <img src={userData?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                <span className="font-black text-sm">{userData?.seat_number} 號 {userData?.name}</span>
                <button onClick={() => { signOut(auth); router.push("/login"); }} className="ml-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
              </div>
            </div>
          </div>
          <div className="px-2"><select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="appearance-none bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white dark:border-slate-700/50 rounded-full px-10 py-4 font-black shadow-lg text-sm dark:text-slate-200 min-w-[180px] hover:bg-white outline-none cursor-pointer"><option value="全部">🔍 全部科目</option>{Array.from(new Set(solutions.map(s => s.subject))).map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">{solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
            <motion.div key={sol.id} whileHover={{ y: -8, scale: 1.02 }} onClick={() => { const target = sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : (sol.drive_file_id ? `https://drive.google.com/file/d/${sol.drive_file_id}/preview` : ""); if(target) { writeBatch(db).update(doc(db,"solutions",sol.id),{view_count:increment(1)}).set(doc(collection(db,"view_logs")),{seat_number:userData.seat_number,solution_id:sol.id,viewed_at:serverTimestamp()}).commit().then(() => setViewingPreviewUrl(target)); } }} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-10 rounded-[3.5rem] border border-white dark:border-slate-800/50 shadow-xl hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"><div className="absolute top-0 left-0 w-2.5 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" /><div className="flex flex-col h-full justify-between"><div><div className="text-[10px] text-teal-600 dark:text-teal-400 font-black mb-4 tracking-[0.2em] uppercase bg-teal-50 dark:bg-teal-500/10 px-4 py-1.5 rounded-full w-fit">{sol.subject}</div><h3 className="font-black text-xl md:text-2xl text-slate-800 dark:text-slate-100 group-hover:text-teal-600 transition-colors leading-tight">{sol.title}</h3></div><div className="flex items-center justify-between mt-12"><div className="flex items-center gap-2 text-slate-400 font-bold text-xs"><FileText size={14} /> PDF 解答</div><div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-all shadow-inner"><ChevronRight size={20} /></div></div></div></motion.div>
          ))}</div>
        </div>
      )}

      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden"><div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setViewingPreviewUrl(null)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white dark:bg-slate-900 rounded-t-[3.5rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[90vh] flex flex-col overflow-hidden shadow-2xl relative z-10 border border-transparent dark:border-slate-800"><div className="p-6 md:p-9 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20"><div className="flex items-center gap-4"><div className="p-3 bg-teal-50 dark:bg-teal-500/10 rounded-2xl"><BookOpen size={24} className="text-teal-600" /></div><span className="font-black text-lg italic">正在閱覽解答</span></div><button onClick={() => setViewingPreviewUrl(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded-full font-bold shadow-sm transition-all">✕</button></div><iframe src={viewingPreviewUrl} className="flex-1 w-full border-none" title="PDF Preview" /></motion.div></div>
        )}
      </AnimatePresence>
    </div>
  );
}
