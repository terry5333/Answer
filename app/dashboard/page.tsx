"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, Sparkles, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [sysVersion, setSysVersion] = useState("v2.0.0");
  const [sysNotes, setSysNotes] = useState("");
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [fetchTime, setFetchTime] = useState(Date.now());
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const [uSnap, mSnap, vSnap] = await Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "settings", "maintenance")), getDoc(doc(db, "settings", "changelog"))]);
        if (!uSnap.exists() || !uSnap.data().seat_number) { router.push("/login"); return; }
        const seat = uSnap.data().seat_number;
        if (mSnap.exists() && mSnap.data().active && uSnap.data().role !== "teacher" && !(mSnap.data().testers || []).includes(seat)) { setIsBlocked(true); setLoading(false); return; }
        if (vSnap.exists()) {
          const currentVersion = vSnap.data().version || "v2.0.0";
          setSysVersion(currentVersion); setSysNotes(vSnap.data().notes || "");
          if (localStorage.getItem("terryEdu_version") !== currentVersion) { setShowVersionModal(true); localStorage.setItem("terryEdu_version", currentVersion); }
        }
        const sSnap = await getDoc(doc(db, "students", String(seat)));
        let photo = user.photoURL;
        if (sSnap.exists() && sSnap.data().photo_url !== photo) { await updateDoc(doc(db, "students", String(seat)), { photo_url: photo }); setFetchTime(Date.now()); }
        setUserData({ ...uSnap.data(), name: sSnap.exists() ? sSnap.data().name : uSnap.data().name, photo_url: photo });
        const solSnap = await getDocs(collection(db, "solutions"));
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-20 transition-colors overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header：修正擠壓與名稱截斷 */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border rounded-[2rem] p-4 sm:p-6 flex justify-between items-center shadow-xl gap-2 overflow-hidden">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shrink-0"><BookOpen size={20} /></div>
            <div className="flex flex-col min-w-0"><h1 className="text-lg font-black italic truncate leading-tight">TerryEdu</h1><button onClick={() => setShowVersionModal(true)} className="flex items-center gap-1 bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-md text-[9px] font-black w-fit mt-0.5"><Sparkles size={10} /> {sysVersion}</button></div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-9 h-9 shrink-0 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm">{resolvedTheme === "dark" ? <Sun size={14}/> : <Moon size={14}/>}</button>}
            <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 pr-3 rounded-full border min-w-0">
              <img src={userData?.photo_url ? `${userData.photo_url}?t=${fetchTime}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-7 h-7 rounded-full shrink-0 object-cover border border-white" referrerPolicy="no-referrer" />
              <span className="font-black text-xs truncate max-w-[60px] sm:max-w-[120px]">{userData?.seat_number} 號 {userData?.name}</span>
              <button onClick={() => { signOut(auth); router.push("/login"); }} className="text-slate-400 hover:text-red-500 shrink-0"><LogOut size={14} /></button>
            </div>
          </div>
        </div>

        {/* 🚀 V2 國二筆記系統導航 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black italic flex items-center gap-2 px-2"><Sparkles className="text-teal-500" /> 國二學習資源</h2>
          <div className="flex gap-2 overflow-x-auto pb-4 px-2 no-scrollbar scroll-smooth">
            {["全部", "國文", "數學", "理化", "公民"].map((sub) => (
              <button key={sub} onClick={() => setSelectedSubject(sub)} className={`px-8 py-3 rounded-full font-black text-xs transition-all whitespace-nowrap shadow-md border-2 ${selectedSubject === sub ? "bg-teal-500 text-white border-teal-500 scale-105" : "bg-white/70 dark:bg-slate-900/50 border-white/50 text-slate-500"}`}>{sub}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">{solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
          <motion.div key={sol.id} whileHover={{ y: -8 }} onClick={() => { const target = sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : (sol.drive_file_id ? `https://drive.google.com/file/d/${sol.drive_file_id}/preview` : ""); if(target) { setIsIframeLoading(true); writeBatch(db).update(doc(db,"solutions",sol.id),{view_count:increment(1)}).set(doc(collection(db,"view_logs")),{seat_number:userData.seat_number,solution_id:sol.id,viewed_at:serverTimestamp()}).commit().then(() => setViewingPreviewUrl(target)); } }} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-10 rounded-[3.5rem] border shadow-xl cursor-pointer relative overflow-hidden transition-all"><div className="flex flex-col h-full justify-between"><div><div className="text-[10px] text-teal-600 font-black mb-4 tracking-widest bg-teal-50 dark:bg-teal-500/10 px-4 py-1.5 rounded-full w-fit">{sol.subject}</div><h3 className="font-black text-xl md:text-2xl leading-tight group-hover:text-teal-500 transition-colors">{sol.title}</h3></div><div className="flex items-center justify-between mt-12 text-slate-400 text-xs font-bold"><div className="flex items-center gap-2"><FileText size={14} /> PDF 解答</div><ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" /></div></div></motion.div>
        ))}</div>
      </div>

      <AnimatePresence>{showVersionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowVersionModal(false)} /><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl relative z-10 border"><div className="flex justify-center mb-6"><div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-500 rounded-3xl flex items-center justify-center shadow-inner"><Sparkles size={32} /></div></div><h2 className="text-2xl font-black text-center mb-2">V2 系統升級公告</h2><div className="text-center mb-8"><span className="bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">{sysVersion}</span></div><div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border space-y-4 mb-8">{sysNotes.split('\n').map((note, idx) => note.trim() && <div key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-teal-500 mt-0.5 shrink-0" /><p className="text-sm font-bold text-slate-600 dark:text-slate-300">{note}</p></div>)}</div><button onClick={() => setShowVersionModal(false)} className="w-full py-4 bg-teal-500 text-white rounded-full font-black text-sm shadow-xl active:scale-95 transition-all">開始學習！</button></motion.div></div>
      )}</AnimatePresence>

      <AnimatePresence>{viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"><div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setViewingPreviewUrl(null)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[92vh] flex flex-col relative z-10 overflow-hidden shadow-2xl border"><div className="p-6 md:p-9 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"><div className="flex items-center gap-4"><BookOpen size={24} className="text-teal-600" /><span className="font-black text-lg italic">閱覽解答</span></div><button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full font-bold">✕</button></div><div className="relative flex-1 bg-slate-50 dark:bg-slate-950">{isIframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10 bg-slate-50 dark:bg-slate-950"><div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在讀取雲端解答...</p></div>}<iframe src={viewingPreviewUrl} className="w-full h-full border-none relative z-0" onLoad={() => setIsIframeLoading(false)} /></div></motion.div></div>
      )}</AnimatePresence>
    </div>
  );
}
