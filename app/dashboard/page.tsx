"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp, updateDoc, addDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, Sparkles, CheckCircle2, PenTool, X, User } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState(Date.now());
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // 系統狀態
  const [viewMode, setViewMode] = useState<"solutions" | "notes">("solutions");
  const [selectedSubject, setSelectedSubject] = useState("全部");
  
  // 解答系統狀態
  const [solutions, setSolutions] = useState<any[]>([]);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  
  // 🚀 筆記系統狀態
  const [notes, setNotes] = useState<any[]>([]);
  const [isWritingNote, setIsWritingNote] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  
  // 版本控制狀態
  const [sysVersion, setSysVersion] = useState("v2.0.0");
  const [sysNotes, setSysNotes] = useState("");
  const [showVersionModal, setShowVersionModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const [uSnap, vSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)), 
          getDoc(doc(db, "settings", "changelog"))
        ]);
        
        if (!uSnap.exists() || !uSnap.data().seat_number) { router.push("/login"); return; }
        const seat = uSnap.data().seat_number;
        
        if (vSnap.exists()) {
          const currentVersion = vSnap.data().version || "v2.0.0";
          setSysVersion(currentVersion); 
          setSysNotes(vSnap.data().notes || "");
          if (localStorage.getItem("terryEdu_version") !== currentVersion) { 
            setShowVersionModal(true); 
            localStorage.setItem("terryEdu_version", currentVersion); 
          }
        }
        
        const sSnap = await getDoc(doc(db, "students", String(seat)));
        let photo = user.photoURL;
        if (sSnap.exists() && sSnap.data().photo_url !== photo) { 
          await updateDoc(doc(db, "students", String(seat)), { photo_url: photo }); 
          setFetchTime(Date.now()); 
        }
        
        setUserData({ 
          uid: user.uid, 
          ...uSnap.data(), 
          name: sSnap.exists() ? sSnap.data().name : uSnap.data().name, 
          photo_url: photo 
        });

        // 同時抓取解答與筆記
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

  // 🚀 儲存新筆記邏輯
  const handleSaveNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingNote(true);
    const formData = new FormData(e.currentTarget);
    const newNote = {
      subject: formData.get('subject'),
      chapter: formData.get('chapter'),
      title: formData.get('title'),
      content: formData.get('content'),
      author_uid: userData.uid,
      author_name: userData.name,
      seat_number: userData.seat_number,
      photo_url: userData.photo_url,
      likes: 0,
      created_at: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, "notes"), newNote);
      // 更新本地狀態，不用重新整理就能看到新筆記
      setNotes([{ id: docRef.id, ...newNote, created_at: { toDate: () => new Date() } }, ...notes]);
      setIsWritingNote(false);
    } catch (error) {
      alert("儲存筆記失敗，請重試！");
    }
    setIsSavingNote(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-24 transition-colors overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header 區塊 */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-[2rem] p-4 sm:p-6 flex justify-between items-center shadow-xl gap-2 overflow-hidden">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shrink-0"><BookOpen size={20} /></div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg font-black italic truncate leading-tight dark:text-white">TerryEdu</h1>
              <span className="text-teal-500 text-[9px] font-black uppercase tracking-widest mt-0.5">{sysVersion}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-9 h-9 shrink-0 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm text-slate-600 dark:text-slate-300">{resolvedTheme === "dark" ? <Sun size={14}/> : <Moon size={14}/>}</button>}
            <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 pr-3 rounded-full border border-white/50 dark:border-slate-700 min-w-0 text-slate-700 dark:text-slate-200">
              <img src={userData?.photo_url ? `${userData.photo_url}?t=${fetchTime}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.name}`} className="w-7 h-7 rounded-full shrink-0 object-cover border border-white" referrerPolicy="no-referrer" />
              <span className="font-black text-xs truncate max-w-[60px] sm:max-w-[120px]">{userData?.seat_number} 號 {userData?.name}</span>
              <button onClick={() => { signOut(auth); router.push("/login"); }} className="text-slate-400 hover:text-red-500 shrink-0"><LogOut size={14} /></button>
            </div>
          </div>
        </div>

        {/* 🚀 核心切換器：解答 vs 筆記 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
            <button onClick={() => setViewMode("solutions")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-black text-xs transition-all ${viewMode === "solutions" ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}><FileText size={14}/> 找解答</button>
            <button onClick={() => setViewMode("notes")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-black text-xs transition-all ${viewMode === "notes" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}><PenTool size={14}/> 看筆記</button>
          </div>
          
          {viewMode === "notes" && (
            <button onClick={() => setIsWritingNote(true)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full font-black text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
              <PenTool size={14} /> 撰寫新筆記
            </button>
          )}
        </div>

        {/* 科目導航列 */}
        <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar scroll-smooth">
          {["全部", "國文", "數學", "理化", "公民"].map((sub) => (
            <button key={sub} onClick={() => setSelectedSubject(sub)} className={`px-6 py-2.5 rounded-full font-black text-xs transition-all whitespace-nowrap shadow-sm border-2 ${selectedSubject === sub ? (viewMode === "solutions" ? "bg-teal-500 text-white border-teal-500 scale-105" : "bg-indigo-500 text-white border-indigo-500 scale-105") : "bg-white/70 dark:bg-slate-900/50 border-transparent text-slate-500"}`}>{sub}</button>
          ))}
        </div>

        {/* 📚 內容展示區 */}
        <AnimatePresence mode="wait">
          {viewMode === "solutions" ? (
            <motion.div key="solutions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
                <div key={sol.id} onClick={() => { const target = sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : (sol.drive_file_id ? `https://drive.google.com/file/d/${sol.drive_file_id}/preview` : ""); if(target) { setIsIframeLoading(true); writeBatch(db).update(doc(db,"solutions",sol.id),{view_count:increment(1)}).set(doc(collection(db,"view_logs")),{seat_number:userData.seat_number,solution_id:sol.id,viewed_at:serverTimestamp()}).commit().then(() => setViewingPreviewUrl(target)); } }} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/50 dark:border-slate-800 shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[180px]">
                  <div><div className="text-[10px] text-teal-600 font-black mb-3 tracking-widest bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-full w-fit">{sol.subject}</div><h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-teal-500 transition-colors">{sol.title}</h3></div>
                  <div className="flex items-center justify-between mt-6 text-slate-400 text-xs font-bold"><div className="flex items-center gap-2"><FileText size={14} /> PDF 解答</div><ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="notes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.filter(n => selectedSubject === "全部" || n.subject === selectedSubject).map(note => (
                <div key={note.id} onClick={() => setViewingNote(note)} className="group bg-white/60 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/50 dark:border-slate-800 shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[200px]">
                  <div>
                    <div className="flex gap-2 mb-3">
                      <span className="text-[10px] text-indigo-600 font-black tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{note.subject}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full truncate max-w-[120px]">{note.chapter}</span>
                    </div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-indigo-500 transition-colors line-clamp-2">{note.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <img src={note.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${note.author_name}`} className="w-6 h-6 rounded-full" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{note.author_name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{note.created_at?.toDate ? note.created_at.toDate().toLocaleDateString() : '剛剛'}</span>
                  </div>
                </div>
              ))}
              {notes.filter(n => selectedSubject === "全部" || n.subject === selectedSubject).length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 font-bold text-sm flex flex-col items-center gap-3">
                  <PenTool size={32} className="opacity-50" />
                  目前還沒有人分享這個科目的筆記喔！搶先成為第一個吧！
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🚀 撰寫筆記 Modal */}
      <AnimatePresence>
        {isWritingNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSavingNote && setIsWritingNote(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h2 className="text-lg font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><PenTool size={18} /> 新增學習筆記</h2>
                <button onClick={() => setIsWritingNote(false)} disabled={isSavingNote} className="p-2 bg-slate-200/50 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={16} /></button>
              </div>
              
              <form onSubmit={handleSaveNote} className="flex flex-col flex-1 overflow-hidden p-6 gap-5">
                <div className="flex gap-4">
                  <select name="subject" required className="w-1/3 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none text-slate-700 dark:text-slate-200 border border-transparent focus:border-indigo-500 transition-colors">
                    <option value="">選擇科目</option>
                    <option value="國文">國文</option><option value="數學">數學</option>
                    <option value="理化">理化</option><option value="公民">公民</option>
                    <option value="英文">英文</option><option value="歷史">歷史</option>
                    <option value="地理">地理</option>
                  </select>
                  <input name="chapter" required placeholder="章節 (例如：2-1)" className="w-2/3 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none text-slate-700 dark:text-slate-200 border border-transparent focus:border-indigo-500 transition-colors" />
                </div>
                <input name="title" required placeholder="筆記標題 (一句話總結重點)" className="bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm font-black outline-none text-slate-800 dark:text-white border border-transparent focus:border-indigo-500 transition-colors" />
                
                <textarea name="content" required placeholder="在這裡寫下你的重點筆記... (支援簡單排版)" className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl px-5 py-4 text-sm font-medium outline-none text-slate-700 dark:text-slate-200 border border-transparent focus:border-indigo-500 transition-colors resize-none min-h-[200px]" />
                
                <button type="submit" disabled={isSavingNote} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  {isSavingNote ? "發佈中..." : "確認發佈筆記"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 閱讀筆記 Modal */}
      <AnimatePresence>
        {viewingNote && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewingNote(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col h-[90vh] sm:h-[85vh] border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 sm:p-8 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <span className="text-[10px] text-indigo-600 font-black tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{viewingNote.subject}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{viewingNote.chapter}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-tight">{viewingNote.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <img src={viewingNote.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingNote.author_name}`} className="w-6 h-6 rounded-full" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{viewingNote.seat_number}號 {viewingNote.author_name}</span>
                    <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                    <span className="text-xs font-bold text-slate-400">{viewingNote.created_at?.toDate ? viewingNote.created_at.toDate().toLocaleString() : '剛剛'}</span>
                  </div>
                </div>
                <button onClick={() => setViewingNote(null)} className="w-10 h-10 bg-slate-200/50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"><X size={20} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white dark:bg-slate-900">
                <div className="prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none whitespace-pre-wrap font-medium leading-relaxed">
                  {viewingNote.content}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 解答預覽 Modal (保持原樣，僅省略以節省空間) */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-4"><div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setViewingPreviewUrl(null)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[4rem] w-full max-w-6xl h-[96vh] md:h-[92vh] flex flex-col relative z-10 overflow-hidden shadow-2xl border"><div className="p-6 md:p-9 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"><div className="flex items-center gap-4"><BookOpen size={24} className="text-teal-600" /><span className="font-black text-lg italic">閱覽解答</span></div><button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full font-bold flex items-center justify-center">✕</button></div><div className="relative flex-1 bg-slate-50 dark:bg-slate-950">{isIframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10 bg-slate-50 dark:bg-slate-950"><div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在讀取雲端解答...</p></div>}<iframe src={viewingPreviewUrl} className="w-full h-full border-none relative z-0" onLoad={() => setIsIframeLoading(false)} /></div></motion.div></div>
        )}
      </AnimatePresence>

      {/* 版本公告 Modal (保持原樣，僅省略以節省空間) */}
      <AnimatePresence>
        {showVersionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowVersionModal(false)} /><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl relative z-10 border"><div className="flex justify-center mb-6"><div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-500 rounded-3xl flex items-center justify-center shadow-inner"><Sparkles size={32} /></div></div><h2 className="text-2xl font-black text-center mb-2">V2 系統升級公告</h2><div className="text-center mb-8"><span className="bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">{sysVersion}</span></div><div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border space-y-4 mb-8">{sysNotes.split('\n').map((note, idx) => note.trim() && <div key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-teal-500 mt-0.5 shrink-0" /><p className="text-sm font-bold text-slate-600 dark:text-slate-300">{note}</p></div>)}</div><button onClick={() => setShowVersionModal(false)} className="w-full py-4 bg-teal-500 text-white rounded-full font-black text-sm shadow-xl active:scale-95 transition-all">開始學習！</button></motion.div></div>
        )}
      </AnimatePresence>
    </div>
  );
}
