"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp, updateDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, Sparkles, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState(Date.now());
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [solutions, setSolutions] = useState<any[]>([]);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  
  const [sysVersion, setSysVersion] = useState("v2.0.0");
  const [sysNotes, setSysNotes] = useState("");
  const [showVersionModal, setShowVersionModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const [uSnap, mSnap, vSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)), 
          getDoc(doc(db, "settings", "maintenance")),
          getDoc(doc(db, "settings", "changelog"))
        ]);
        
        if (!uSnap.exists() || !uSnap.data().seat_number) { router.push("/login"); return; }
        const seat = uSnap.data().seat_number;
        const isT = uSnap.data().role === "teacher";
        
        if (mSnap.exists() && mSnap.data().active && !isT && !(mSnap.data().testers || []).includes(seat)) { 
          auth.signOut(); return; 
        }
        
        if (vSnap.exists()) {
          const currentVersion = vSnap.data().version || "v2.0.0";
          setSysVersion(currentVersion); setSysNotes(vSnap.data().notes || "");
          if (localStorage.getItem("edu_version") !== currentVersion) { setShowVersionModal(true); localStorage.setItem("edu_version", currentVersion); }
        }
        
        const sSnap = await getDoc(doc(db, "students", String(seat)));
        let photo = user.photoURL;
        if (sSnap.exists() && sSnap.data().photo_url !== photo) { await updateDoc(doc(db, "students", String(seat)), { photo_url: photo }); setFetchTime(Date.now()); }
        setUserData({ uid: user.uid, ...uSnap.data(), name: sSnap.exists() ? sSnap.data().name : uSnap.data().name, photo_url: photo });

        const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("created_at", "desc")));
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const openPreview = (item: any) => {
    const target = item.file_url ? item.file_url.replace(/\/view.*/, "/preview") : (item.drive_file_id ? `https://drive.google.com/file/d/${item.drive_file_id}/preview` : "");
    if(target) {
      setIsIframeLoading(true);
      writeBatch(db).update(doc(db, "solutions", item.id), {view_count: increment(1)})
                    .set(doc(collection(db, "view_logs")), {seat_number: userData.seat_number, solution_id: item.id, viewed_at: serverTimestamp()})
                    .commit().then(() => setViewingPreviewUrl(target));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-24 transition-colors overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-[2.5rem] p-4 sm:p-6 flex justify-between items-center shadow-xl gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shrink-0"><BookOpen size={20} /></div>
            <div className="flex flex-col min-w-0"><h1 className="text-lg font-black italic truncate dark:text-white">系統大廳</h1><span className="text-teal-500 text-[9px] font-black uppercase tracking-widest mt-0.5">{sysVersion}</span></div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-9 h-9 shrink-0 rounded-full bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">{resolvedTheme === "dark" ? <Sun size={14}/> : <Moon size={14}/>}</button>}
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 pr-3 rounded-full min-w-0 text-slate-700 dark:text-slate-200">
              <img src={userData?.photo_url ? `${userData.photo_url}?t=${fetchTime}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-7 h-7 rounded-full shrink-0 object-cover" />
              <span className="font-black text-xs truncate max-w-[60px] sm:max-w-[120px]">{userData?.seat_number} 號 {userData?.name}</span>
              <button onClick={() => { signOut(auth); router.push("/login"); }} className="text-slate-400 hover:text-red-500 shrink-0"><LogOut size={14} /></button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
            {["全部", "國文", "數學", "理化", "公民", "歷史", "地理", "英文"].map((sub) => (
              <button key={sub} onClick={() => setSelectedSubject(sub)} className={`px-6 py-2.5 rounded-full font-black text-xs transition-all whitespace-nowrap shadow-sm border-2 ${selectedSubject === sub ? "bg-teal-500 text-white border-teal-500 scale-105" : "bg-white/70 dark:bg-slate-900/50 border-transparent text-slate-500"}`}>{sub}</button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
              <div key={sol.id} onClick={() => openPreview(sol)} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[180px] border border-white/50 dark:border-slate-800">
                <div><div className="text-[10px] text-teal-600 font-black mb-3 tracking-widest bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-full w-fit">{sol.subject}</div><h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-500 transition-colors">{sol.title}</h3></div>
                <div className="flex items-center justify-between mt-6 text-slate-400 text-xs font-bold"><div className="flex items-center gap-2"><FileText size={14} /> PDF 解答</div><ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></div>
              </div>
            ))}
            {solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm">
                目前尚無該科目的解答喔！
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🚀 修復破圖的 PDF 預覽 Modal */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setViewingPreviewUrl(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white dark:bg-slate-900 rounded-t-[3.5rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[90vh] flex flex-col relative z-10 border dark:border-slate-800 shadow-2xl overflow-hidden">
              
              <div className="p-5 md:p-7 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center rounded-2xl">
                    <BookOpen size={20} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="font-black text-lg italic">閱覽解答</span>
                </div>
                <button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full font-bold transition-all">✕</button>
              </div>

              {/* 核心修正：relative flex-1 包裹 absolute inset-0 iframe */}
              <div className="relative flex-1 w-full bg-slate-100 dark:bg-slate-950">
                {isIframeLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-100 dark:bg-slate-950 pointer-events-none">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full" />
                    <p className="text-xs font-black tracking-widest uppercase animate-pulse text-teal-500">載入中...</p>
                  </div>
                )}
                <iframe 
                  src={viewingPreviewUrl} 
                  className="absolute inset-0 w-full h-full border-none" 
                  onLoad={() => setIsIframeLoading(false)} 
                  allowFullScreen
                />
              </div>
              
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVersionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowVersionModal(false)} /><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl relative z-10 border"><div className="flex justify-center mb-6"><div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-500 rounded-3xl flex items-center justify-center shadow-inner"><Sparkles size={32} /></div></div><h2 className="text-2xl font-black text-center mb-2">系統升級公告</h2><div className="text-center mb-8"><span className="bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">{sysVersion}</span></div><div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border space-y-4 mb-8">{sysNotes.split('\n').map((note, idx) => note.trim() && <div key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-teal-500 mt-0.5 shrink-0" /><p className="text-sm font-bold text-slate-600 dark:text-slate-300">{note}</p></div>)}</div><button onClick={() => setShowVersionModal(false)} className="w-full py-4 bg-teal-500 text-white rounded-full font-black text-sm shadow-xl active:scale-95 transition-all">開始學習！</button></motion.div></div>
        )}
      </AnimatePresence>

      <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
