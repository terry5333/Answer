"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase"; 
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Users, BarChart3, Book, AlertTriangle, Eye, Sun, Moon, BookOpen, ShieldCheck, Search, Trash2, CheckCircle, Trophy, PlusCircle, Edit2, Link as LinkIcon, Sparkles, PenTool, BrainCircuit } from "lucide-react";
import { useTheme } from "next-themes";

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("solutions");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  
  const [newSubject, setNewSubject] = useState(""); 
  const [newSeat, setNewSeat] = useState("");
  const [newStudentName, setNewStudentName] = useState("");

  const [maintenance, setMaintenance] = useState({ active: false, testers: [] as number[] });
  const [showTesterModal, setShowTesterModal] = useState(false);
  const [selectedTesters, setSelectedTesters] = useState<number[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editName, setEditName] = useState("");
  
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);

  const [orphanedFiles, setOrphanedFiles] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortMethod, setSortMethod] = useState("time");
  
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const [systemVersion, setSystemVersion] = useState("v2.0.0");
  const [systemNotes, setSystemNotes] = useState("");

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || snap.data().role !== "teacher") { router.push("/dashboard"); return; }
      await Promise.all([fetchAdminData(), fetchSystemSettings()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAdminData = async () => {
    try {
      const subSnap = await getDocs(collection(db, "subjects"));
      const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("created_at", "desc")));
      const notesSnap = await getDocs(query(collection(db, "notes"), orderBy("created_at", "desc")));
      const stuSnap = await getDocs(query(collection(db, "students"), orderBy("seat_number", "asc")));
      const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc")));
      
      setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setNotes(notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStudents(stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastFetchTime(Date.now());
    } catch (e) { console.error(e); }
  };

  const fetchSystemSettings = async () => {
    try {
      const mSnap = await getDoc(doc(db, "settings", "maintenance"));
      if (mSnap.exists()) { setMaintenance({ active: mSnap.data().active, testers: mSnap.data().testers || [] }); setSelectedTesters(mSnap.data().testers || []); }
      const vSnap = await getDoc(doc(db, "settings", "changelog"));
      if (vSnap.exists()) { setSystemVersion(vSnap.data().version || "v2.0.0"); setSystemNotes(vSnap.data().notes || ""); }
    } catch(e) { console.error("抓取設定失敗", e); }
  };

  const handlePublishUpdate = async () => {
    if (!systemVersion.trim() || !systemNotes.trim()) return alert("請填寫版本號與更新內容！");
    try {
      await setDoc(doc(db, "settings", "changelog"), { version: systemVersion.trim(), notes: systemNotes.trim(), updated_at: serverTimestamp() });
      alert("✅ 更新日誌已發佈！");
    } catch(e) { alert("發佈失敗"); }
  };

  const fetchDriveFiles = async () => {
    setIsFetchingDrive(true);
    try {
      const res = await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "LIST_FILES" }) });
      const data = await res.json();
      if (data.status === 'success') {
        const boundIds = [...solutions, ...notes].map(item => item.drive_file_id || (item.file_url?.match(/[-\w]{25,35}/)?.[0])).filter(Boolean);
        setAvailableFiles(data.files.filter((f: any) => !boundIds.includes(f.id)));
      }
    } catch (e) { alert("讀取雲端檔案失敗"); }
    setIsFetchingDrive(false);
  };

  // 🚀 核心綁定邏輯：支援 slug 與 note_type
  const handleBindResource = async (e: React.FormEvent<HTMLFormElement>, type: "solutions" | "notes") => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const fileId = formData.get('fileId') as string;
    const chapter = formData.get('chapter') as string || "";
    const noteType = formData.get('note_type') as string || "mindmap";
    const slug = formData.get('slug') as string || "";

    const selectedFile = availableFiles.find(f => f.id === fileId);
    if (!selectedFile) return alert("請先選擇要綁定的雲端檔案！");

    setIsUploading(true);
    try {
      const payload: any = { subject, title, file_url: selectedFile.url, drive_file_id: selectedFile.id, view_count: 0, created_at: serverTimestamp() };
      
      if (type === "notes") {
        payload.chapter = chapter;
        payload.note_type = noteType;
        if (slug) payload.slug = slug.trim().toLowerCase().replace(/\s+/g, '-');
      }

      await addDoc(collection(db, type), payload);
      setAvailableFiles(prev => prev.filter(f => f.id !== fileId));
      await fetchAdminData();
      (e.target as HTMLFormElement).reset();
      alert(`✅ ${type === "solutions" ? "解答" : "筆記"}綁定成功！`);
    } catch (err: any) { alert(`❌ 綁定失敗: \n${err.message}`); } finally { setIsUploading(false); }
  };

  const handleFullDelete = async (item: any, type: "solutions" | "notes") => {
    if (!confirm(`確定徹底刪除「${item.title}」並移除雲端檔案？`)) return;
    try {
      if (item.file_url) await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "DELETE", fileUrl: item.file_url }) });
      await deleteDoc(doc(db, type, item.id));
      fetchAdminData();
    } catch (error) { alert("刪除失敗"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full shadow-lg" /></div>;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg">T</div><h1 className="text-xl font-black italic tracking-tighter hidden sm:block">TerryEdu Admin</h1></div>
          <div className="flex items-center gap-3">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm">{resolvedTheme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}</button>}
            <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-slate-200 dark:bg-slate-800 px-6 py-2.5 rounded-full font-bold text-sm shadow-sm transition-all hover:bg-slate-300">登出</button>
          </div>
        </div>

        {/* 導航 */}
        <div className="flex justify-start sm:justify-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-full shadow-lg border border-white/50 dark:border-slate-700/50 sticky top-4 z-40 transition-colors overflow-x-auto no-scrollbar">
          {[
            {id:"solutions",label:"解答",icon:<Book size={16}/>,color:"bg-teal-600"},
            {id:"notes",label:"筆記管理",icon:<PenTool size={16}/>,color:"bg-indigo-600"},
            {id:"students",label:"學生系統",icon:<Users size={16}/>,color:"bg-blue-500"}
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${activeTab === t.id ? `text-white ${t.color}` : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
            
            {/* 略縮：解答管理 Tab (與前版相同) */}
            {activeTab === "solutions" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 科目設定區塊 */}
                <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 h-fit transition-colors">
                  <h2 className="text-lg font-black mb-6 flex items-center gap-2"><div className="w-1.5 h-5 bg-teal-500 rounded-full" /> 科目設定</h2>
                  <div className="flex gap-2 mb-6"><input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white dark:bg-slate-800 outline-none text-sm shadow-inner transition-colors" /><button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-teal-600 text-white w-12 h-12 rounded-full font-bold shadow-lg transition-all active:scale-95">+</button></div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">{subjects.map(s => <div key={s.id} className="flex justify-between bg-white/80 dark:bg-slate-800/80 px-6 py-3 rounded-2xl font-bold border border-gray-50 dark:border-slate-700 transition-colors">{s.name}<button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300 hover:text-red-500 transition-colors">✕</button></div>)}</div>
                </div>
                {/* 綁定區塊 */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <h2 className="text-lg font-black flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-6"><Book size={20}/> 綁定雲端解答</h2>
                    <form onSubmit={(e) => handleBindResource(e, "solutions")} className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                        <select name="subject" required className="w-full sm:w-1/3 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none"><option value="">選擇科目</option>{subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        <input name="title" required placeholder="解答名稱 (例：段考二詳解)" className="flex-1 w-full bg-white dark:bg-slate-800 rounded-full px-6 py-3.5 font-bold text-sm outline-none" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                        <div className="flex-1 flex w-full gap-2 items-center">
                          <select name="fileId" required className="flex-1 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none">
                            {availableFiles.length === 0 ? <option value="">無待綁定檔案...</option> : <option value="">選擇上傳的 PDF...</option>}{availableFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <button type="button" onClick={() => fetchDriveFiles()} className="bg-white dark:bg-slate-800 p-3.5 rounded-full text-slate-500 shrink-0"><RefreshCw size={18} className={isFetchingDrive ? "animate-spin text-teal-500" : ""} /></button>
                        </div>
                        <button disabled={isUploading || availableFiles.length === 0} className="w-full sm:w-auto bg-teal-600 text-white font-black py-3.5 px-10 rounded-full shadow-lg disabled:opacity-50 text-sm active:scale-95 shrink-0">綁定</button>
                      </div>
                    </form>
                  </div>
                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <h2 className="text-lg font-black mb-6">📚 解答庫清單</h2>
                    <div className="space-y-3">{solutions.map(sol => <div key={sol.id} className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 px-6 py-4 rounded-[2rem] shadow-sm border border-white dark:border-slate-700/50 group hover:bg-white/95 transition-all"><span className="font-bold text-sm"><span className="text-teal-500 mr-2 text-[10px] bg-teal-50 dark:bg-teal-500/10 px-2 py-1 rounded-full">[{sol.subject}]</span>{sol.title}</span><div className="flex gap-2"><button onClick={() => setViewingPreviewUrl(sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : `https://drive.google.com/file/d/${sol.drive_file_id}/preview`)} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-all">預覽</button><button onClick={() => handleFullDelete(sol, "solutions")} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">刪除</button></div></div>)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 🚀 === 筆記管理 Tab (重點更新：加入類別與短網址) === */}
            {activeTab === "notes" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 h-fit transition-colors">
                  <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
                    <h2 className="text-sm font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-2"><PenTool size={16}/> 發佈手繪筆記</h2>
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 font-bold leading-relaxed">請將 iPad 筆記輸出為 PDF 後丟入 Drive 綁定。您可以設定專屬短網址 (Slug) 方便在班群分享！</p>
                  </div>
                </div>
                
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <h2 className="text-lg font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-6"><LinkIcon size={20}/> 綁定心智圖 / 筆記</h2>
                    
                    <form onSubmit={(e) => handleBindResource(e, "notes")} className="flex flex-col gap-4">
                      {/* 🚀 新增類型與章節 */}
                      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                        <select name="subject" required className="w-full sm:w-1/4 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none"><option value="">科目</option>{subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        <select name="note_type" required className="w-full sm:w-1/4 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none text-indigo-500"><option value="mindmap">🧠 心智圖</option><option value="note">📝 重點筆記</option></select>
                        <input name="chapter" required placeholder="單元 (例: 3-2)" className="w-full sm:w-1/4 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none" />
                        <input name="title" required placeholder="標題重點" className="flex-1 w-full bg-white dark:bg-slate-800 rounded-full px-6 py-3.5 font-bold text-sm outline-none" />
                      </div>

                      {/* 🚀 新增專屬短網址 */}
                      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                        <div className="flex items-center w-full sm:w-1/3 bg-white dark:bg-slate-800 rounded-full px-4 py-1 overflow-hidden shadow-inner">
                          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap border-r dark:border-slate-700 pr-2 mr-2">/n/</span>
                          <input name="slug" placeholder="自訂網址 (選填)" className="w-full bg-transparent font-bold text-sm outline-none text-indigo-500 h-10" />
                        </div>
                        <div className="flex-1 flex w-full gap-2 items-center">
                          <select name="fileId" required className="flex-1 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm outline-none">
                            {availableFiles.length === 0 ? <option value="">無待綁定檔案...</option> : <option value="">選擇上傳的 PDF...</option>}{availableFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <button type="button" onClick={() => fetchDriveFiles()} className="bg-white dark:bg-slate-800 p-3.5 rounded-full text-slate-500 shrink-0"><RefreshCw size={18} className={isFetchingDrive ? "animate-spin text-indigo-500" : ""} /></button>
                        </div>
                        <button disabled={isUploading || availableFiles.length === 0} className="w-full sm:w-auto bg-indigo-600 text-white font-black py-3.5 px-10 rounded-full shadow-lg disabled:opacity-50 text-sm active:scale-95 shrink-0">發佈</button>
                      </div>
                    </form>

                  </div>

                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <h2 className="text-lg font-black mb-6">📝 筆記展示區</h2>
                    <div className="space-y-3">{notes.map(note => <div key={note.id} className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 px-6 py-4 rounded-[2rem] shadow-sm border border-white dark:border-slate-700/50 group hover:bg-white/95 transition-all"><div className="flex items-center gap-3"><span className="text-indigo-500 text-[10px] bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full font-bold">[{note.subject}] {note.chapter}</span><span className="font-bold text-sm flex items-center gap-2">{note.note_type === 'mindmap' ? '🧠' : '📝'} {note.title} {note.slug && <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">/n/{note.slug}</span>}</span></div><div className="flex gap-2"><button onClick={() => setViewingPreviewUrl(note.file_url ? note.file_url.replace(/\/view.*/, "/preview") : `https://drive.google.com/file/d/${note.drive_file_id}/preview`)} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-all">預覽</button><button onClick={() => handleFullDelete(note, "notes")} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">刪除</button></div></div>)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 其他 Tabs 略縮... (如 Student, Reports，與上一步完全相同) */}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* PDF 預覽 Modal */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-6 overflow-hidden"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg" onClick={() => setViewingPreviewUrl(null)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-5xl h-[95vh] flex flex-col relative z-10 overflow-hidden shadow-2xl border border-white/20 transition-colors"><div className="p-8 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 transition-colors"><div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl"><BookOpen size={20} className="text-indigo-600" /></div><span className="font-black text-lg italic tracking-tight">管理員預覽</span></div><button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded-full font-bold shadow-sm transition-all flex items-center justify-center">✕</button></div><iframe src={viewingPreviewUrl} className="flex-1 w-full border-none" /></motion.div></div>
        )}
      </AnimatePresence>
      <style jsx global>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; } .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
