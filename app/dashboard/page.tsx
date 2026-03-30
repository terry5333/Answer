"use client";
import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp, updateDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, Sparkles, PenTool, BrainCircuit, Hash } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState(Date.now());
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // 🚀 大分區狀態
  const [viewMode, setViewMode] = useState<"solutions" | "notes">("solutions");
  
  // 🚀 篩選器狀態 (解答用)
  const [solSubject, setSolSubject] = useState("全部");

  // 🚀 篩選器狀態 (筆記用 - 三層聯動)
  const [noteSubject, setNoteSubject] = useState("國文"); 
  const [noteType, setNoteType] = useState<"mindmap" | "note">("mindmap"); 
  const [noteChapter, setNoteChapter] = useState("全部");

  const [solutions, setSolutions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
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
          if (localStorage.getItem("terryEdu_version") !== currentVersion) { setShowVersionModal(true); localStorage.setItem("terryEdu_version", currentVersion); }
        }
        
        const sSnap = await getDoc(doc(db, "students", String(seat)));
        let photo = user.photoURL;
        if (sSnap.exists() && sSnap.data().photo_url !== photo) { await updateDoc(doc(db, "students", String(seat)), { photo_url: photo }); setFetchTime(Date.now()); }
        setUserData({ uid: user.uid, ...uSnap.data(), name: sSnap.exists() ? sSnap.data().name : uSnap.data().name, photo_url: photo });

        const [solSnap, notesSnap] = await Promise.all([
          getDocs(collection(db, "solutions")),
          getDocs(query(collection(db, "notes"), orderBy("created_at", "desc")))
        ]);
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setNotes(notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 🚀 動態生成單元標籤
  const availableChapters = useMemo(() => {
    const chapters = notes.filter(n => n.subject === noteSubject && (n.note_type || "mindmap") === noteType && n.chapter).map(n => n.chapter);
    return ["全部", ...Array.from(new Set(chapters)).sort()];
  }, [notes, noteSubject, noteType]);

  // 切換科目或類型時，自動把單元切回「全部」
  useEffect(() => { setNoteChapter("全部"); }, [noteSubject, noteType]);

  const openPreview = (item: any, type: "solutions" | "notes") => {
    const target = item.file_url ? item.file_url.replace(/\/view.*/, "/preview") : (item.drive_file_id ? `https://drive.google.com/file/d/${item.drive_file_id}/preview` : "");
    if(target) {
      setIsIframeLoading(true);
      writeBatch(db).update(doc(db, type, item.id), {view_count: increment(1)})
                    .set(doc(collection(db, "view_logs")), {seat_number: userData.seat_number, solution_id: item.id, viewed_at: serverTimestamp()})
                    .commit().then(() => setViewingPreviewUrl(target));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-24 transition-colors overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-[2.5rem] p-4 sm:p-6 flex justify-between items-center shadow-xl gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shrink-0"><BookOpen size={20} /></div>
            <div className="flex flex-col min-w-0"><h1 className="text-lg font-black italic truncate dark:text-white">TerryEdu</h1><span className="text-teal-500 text-[9px] font-black uppercase tracking-widest mt-0.5">{sysVersion}</span></div>
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

        {/* 🚀 大分區切換開關 (解答 vs 筆記) */}
        <div className="flex justify-center sm:justify-start px-2">
          <div className="flex bg-slate-200/70 dark:bg-slate-800/70 p-1.5 rounded-full w-full sm:w-auto shadow-inner">
            <button onClick={() => setViewMode("solutions")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-full font-black text-xs transition-all ${viewMode === "solutions" ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}><FileText size={16}/> 解答總區</button>
            <button onClick={() => setViewMode("notes")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-full font-black text-xs transition-all ${viewMode === "notes" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}><PenTool size={16}/> 學習筆記</button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          
          {/* ================= 1. 解答模式 ================= */}
          {viewMode === "solutions" ? (
            <motion.div key="solutions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
              <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
                {["全部", "國文", "數學", "理化", "公民", "歷史", "地理", "英文"].map((sub) => (
                  <button key={sub} onClick={() => setSolSubject(sub)} className={`px-6 py-2.5 rounded-full font-black text-xs transition-all whitespace-nowrap shadow-sm border-2 ${solSubject === sub ? "bg-teal-500 text-white border-teal-500 scale-105" : "bg-white/70 dark:bg-slate-900/50 border-transparent text-slate-500"}`}>{sub}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {solutions.filter(s => solSubject === "全部" || s.subject === solSubject).map(sol => (
                  <div key={sol.id} onClick={() => openPreview(sol, "solutions")} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[180px] border border-white/50 dark:border-slate-800">
                    <div><div className="text-[10px] text-teal-600 font-black mb-3 tracking-widest bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-full w-fit">{sol.subject}</div><h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-500 transition-colors">{sol.title}</h3></div>
                    <div className="flex items-center justify-between mt-6 text-slate-400 text-xs font-bold"><div className="flex items-center gap-2"><FileText size={14} /> PDF 解答</div><ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></div>
                  </div>
                ))}
              </div>
            </motion.div>

          ) : (
            
          /* ================= 2. 筆記模式 (三層篩選) ================= */
            <motion.div key="notes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
              
              {/* 第 1 層：選科目 */}
              <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
                {["國文", "數學", "理化", "公民", "歷史", "地理", "英文"].map((sub) => (
                  <button key={sub} onClick={() => setNoteSubject(sub)} className={`px-6 py-2.5 rounded-full font-black text-xs transition-all whitespace-nowrap shadow-sm border-2 ${noteSubject === sub ? "bg-indigo-600 text-white border-indigo-600 scale-105 shadow-indigo-500/20" : "bg-white/70 dark:bg-slate-900/50 border-transparent text-slate-500"}`}>{sub}</button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 px-2 items-start sm:items-center justify-between">
                {/* 第 2 層：選心智圖 or 筆記 */}
                <div className="flex bg-indigo-50 dark:bg-indigo-900/20 p-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <button onClick={() => setNoteType("mindmap")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs transition-all ${noteType === "mindmap" ? "bg-indigo-500 text-white shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}><BrainCircuit size={14}/> 心智圖</button>
                  <button onClick={() => setNoteType("note")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs transition-all ${noteType === "note" ? "bg-indigo-500 text-white shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}><FileText size={14}/> 重點筆記</button>
                </div>

                {/* 第 3 層：動態生成單元 */}
                {availableChapters.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {availableChapters.map(chap => (
                      <button key={chap} onClick={() => setNoteChapter(chap)} className={`flex items-center gap-1 px-4 py-2 rounded-full font-black text-[10px] transition-all whitespace-nowrap border ${noteChapter === chap ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400"}`}>
                        {chap !== "全部" && <Hash size={10}/>} {chap}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 筆記卡片 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.filter(n => n.subject === noteSubject && (n.note_type || "mindmap") === noteType && (noteChapter === "全部" || n.chapter === noteChapter)).map(note => (
                  <div key={note.id} onClick={() => openPreview(note, "notes")} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-indigo-100/50 dark:border-indigo-900/30 shadow-xl shadow-indigo-500/5 cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[180px]">
                    <div>
                      <div className="flex gap-2 mb-3">
                        <span className="text-[10px] text-indigo-600 font-black tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{note.subject}</span>
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{note.chapter}</span>
                      </div>
                      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-indigo-500 transition-colors line-clamp-2">{note.title}</h3>
                    </div>
                    <div className="flex items-center justify-between mt-6 text-indigo-400 text-xs font-bold"><div className="flex items-center gap-2">{noteType === "mindmap" ? <BrainCircuit size={14} /> : <FileText size={14} />} 觀看{noteType === "mindmap" ? "心智圖" : "筆記"}</div><ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></div>
                  </div>
                ))}
                
                {notes.filter(n => n.subject === noteSubject && (n.note_type || "mindmap") === noteType && (noteChapter === "全部" || n.chapter === noteChapter)).length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-4">
                    {noteType === "mindmap" ? <BrainCircuit size={48} className="opacity-20" /> : <PenTool size={48} className="opacity-20" />}
                    <p>【{noteSubject}】目前還沒有上傳{noteType === "mindmap" ? "心智圖" : "筆記"}喔！<br/>敬請期待！ ⚡️</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PDF 預覽 Modal */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setViewingPreviewUrl(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white dark:bg-slate-900 rounded-t-[3.5rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[90vh] flex flex-col relative z-10 border shadow-2xl">
              <div className="p-6 md:p-9 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4"><BookOpen size={24} className={viewMode === "solutions" ? "text-teal-600" : "text-indigo-600"} /><span className="font-black text-lg italic">閱覽模式</span></div>
                <button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full font-bold">✕</button>
              </div>
              <div className="relative flex-1 w-full bg-slate-50 dark:bg-slate-950">
                {isIframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10 bg-slate-50 dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className={`w-14 h-14 border-4 border-t-transparent rounded-full ${viewMode === "solutions" ? "border-teal-500/30 border-t-teal-500" : "border-indigo-500/30 border-t-indigo-500"}`} /><p className={`text-xs font-black tracking-widest uppercase animate-pulse ${viewMode === "solutions" ? "text-teal-400" : "text-indigo-400"}`}>正在載入超高畫質 PDF...</p></div>}
                <iframe src={viewingPreviewUrl} className="w-full h-full border-none relative z-0" onLoad={() => setIsIframeLoading(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
