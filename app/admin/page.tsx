"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase"; 
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Upload, Users, BarChart3, Book, AlertTriangle, Eye, Sun, Moon, BookOpen, ShieldCheck, Search, Trash2, CheckCircle, Trophy, PlusCircle, Edit2, Link as LinkIcon, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("solutions");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
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
  
  // 🚀 新增：版本控制狀態
  const [systemVersion, setSystemVersion] = useState("v1.0.0");
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
      const stuSnap = await getDocs(query(collection(db, "students"), orderBy("seat_number", "asc")));
      const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc")));
      setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStudents(stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastFetchTime(Date.now());
    } catch (e) { console.error(e); }
  };

  // 🚀 新增：抓取系統設定（包含維護模式與版本更新日誌）
  const fetchSystemSettings = async () => {
    try {
      const mSnap = await getDoc(doc(db, "settings", "maintenance"));
      if (mSnap.exists()) {
        const data = mSnap.data();
        setMaintenance({ active: data.active, testers: data.testers || [] });
        setSelectedTesters(data.testers || []);
      }
      
      const vSnap = await getDoc(doc(db, "settings", "changelog"));
      if (vSnap.exists()) {
        setSystemVersion(vSnap.data().version || "v1.0.0");
        setSystemNotes(vSnap.data().notes || "");
      }
    } catch(e) { console.error("抓取設定失敗", e); }
  };

  // 🚀 新增：發佈更新日誌
  const handlePublishUpdate = async () => {
    if (!systemVersion.trim() || !systemNotes.trim()) return alert("請填寫版本號與更新內容！");
    try {
      await setDoc(doc(db, "settings", "changelog"), { 
        version: systemVersion.trim(), 
        notes: systemNotes.trim(),
        updated_at: serverTimestamp()
      });
      alert("✅ 更新日誌已發佈！學生下次登入時會自動跳出通知。");
    } catch(e) { alert("發佈失敗"); }
  };

  const fetchDriveFiles = async () => {
    setIsFetchingDrive(true);
    try {
      const res = await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "LIST_FILES" }) });
      const data = await res.json();
      if (data.status === 'success') {
        const dbFileIds = solutions.map(sol => sol.drive_file_id || (sol.file_url?.match(/[-\w]{25,35}/)?.[0])).filter(Boolean);
        setAvailableFiles(data.files.filter((f: any) => !dbFileIds.includes(f.id)));
      }
    } catch (e) { alert("讀取雲端檔案失敗"); }
    setIsFetchingDrive(false);
  };

  const handleBindSolution = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const fileId = formData.get('fileId') as string;

    const selectedFile = availableFiles.find(f => f.id === fileId);
    if (!selectedFile) return alert("請先選擇要綁定的雲端檔案！");

    setIsUploading(true);
    try {
      await addDoc(collection(db, "solutions"), { subject, title, file_url: selectedFile.url, drive_file_id: selectedFile.id, view_count: 0, created_at: serverTimestamp() });
      setAvailableFiles(prev => prev.filter(f => f.id !== fileId));
      await fetchAdminData();
      (e.target as HTMLFormElement).reset();
      alert("✅ 解答綁定成功！");
    } catch (err: any) { alert(`❌ 綁定失敗: \n${err.message}`); } finally { setIsUploading(false); }
  };

  const handleSyncCheck = async () => {
    setIsSyncing(true);
    setShowSyncModal(true);
    try {
      const freshSolSnap = await getDocs(collection(db, "solutions"));
      const latestSolutions = freshSolSnap.docs.map(doc => doc.data());
      const res = await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "LIST_FILES" }) });
      const data = await res.json();

      if (data.status === 'success') {
        const dbFileIds = latestSolutions.map(sol => sol.drive_file_id || (sol.file_url?.match(/[-\w]{25,35}/)?.[0])).filter(Boolean);
        setOrphanedFiles(data.files.filter((cf: any) => !dbFileIds.includes(cf.id)));
      }
    } catch (e) { alert("比對發生錯誤"); } finally { setIsSyncing(false); }
  };

  const handleSyncDelete = async (fileUrl: string) => {
    if (!confirm("確定要從雲端永久刪除此檔案嗎？")) return;
    try {
      await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "DELETE", fileUrl }) });
      setOrphanedFiles(prev => prev.filter(f => f.url !== fileUrl));
      setAvailableFiles(prev => prev.filter(f => f.url !== fileUrl));
    } catch (e) { alert("刪除失敗"); }
  };

  const handleFullDelete = async (sol: any) => {
    if (!confirm(`確定徹底刪除「${sol.title}」並移除雲端檔案？`)) return;
    try {
      if (sol.file_url) await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "DELETE", fileUrl: sol.file_url }) });
      await deleteDoc(doc(db, "solutions", sol.id));
      fetchAdminData();
      fetchDriveFiles();
    } catch (error) { alert("刪除失敗"); }
  };

  const handleAddStudent = async () => {
    if (!newSeat || !newStudentName) return;
    try {
      await setDoc(doc(db, "students", newSeat), { name: newStudentName, seat_number: Number(newSeat), bound_uid: null, photo_url: null });
      setNewSeat(""); setNewStudentName(""); fetchAdminData();
    } catch (e) { alert("建檔失敗"); }
  };

  const handleUpdateStudent = async () => {
    if (!editName.trim() || !editingStudent) return;
    try {
      await updateDoc(doc(db, "students", editingStudent.id), { name: editName.trim() });
      if (editingStudent.bound_uid) await updateDoc(doc(db, "users", editingStudent.bound_uid), { name: editName.trim() });
      await fetchAdminData(); setEditingStudent(null); alert("✅ 學生資料已更新");
    } catch (e) { alert("更新失敗"); }
  };

  const handleDataRepair = async () => {
    if (!confirm("確定校正統計次數？")) return;
    setLoading(true);
    const logSnap = await getDocs(collection(db, "view_logs"));
    const solSnap = await getDocs(collection(db, "solutions"));
    const batch = writeBatch(db);
    const countsMap: { [key: string]: number } = {};
    solSnap.docs.forEach(d => countsMap[d.id] = 0);
    logSnap.docs.forEach(d => { if (countsMap[d.data().solution_id] !== undefined) countsMap[d.data().solution_id]++; });
    for (const id in countsMap) batch.update(doc(db, "solutions", id), { view_count: countsMap[id] });
    await batch.commit(); await fetchAdminData(); setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full shadow-lg" /></div>;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg">T</div><h1 className="text-xl font-black italic tracking-tighter hidden sm:block">TerryEdu Admin</h1></div>
          <div className="flex items-center gap-3">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm">{resolvedTheme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}</button>}
            <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-slate-200 dark:bg-slate-800 px-6 py-2.5 rounded-full font-bold text-sm shadow-sm transition-all hover:bg-slate-300">登出</button>
          </div>
        </div>

        <div className="flex justify-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-full shadow-lg border border-white/50 dark:border-slate-700/50 sticky top-4 z-40 transition-colors">
          {[{id:"solutions",label:"解答管理",icon:<Book size={16}/>,color:"bg-indigo-600"},{id:"students",label:"學生與系統",icon:<Users size={16}/>,color:"bg-teal-600"},{id:"reports",label:"數據報表",icon:<BarChart3 size={16}/>,color:"bg-orange-500"}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === t.id ? `text-white ${t.color}` : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {!isVerified ? (
          <div className="flex justify-center py-20"><div className="bg-white/80 dark:bg-slate-900/70 p-12 rounded-[3rem] shadow-2xl border border-white dark:border-slate-700/50 text-center"><h2 className="text-xl font-bold mb-8 text-indigo-900 dark:text-indigo-300 italic">管理員安全驗證</h2><Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} /></div></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
              
              {activeTab === "solutions" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 h-fit transition-colors">
                    <h2 className="text-lg font-black mb-6 flex items-center gap-2"><div className="w-1.5 h-5 bg-indigo-500 rounded-full" /> 科目設定</h2>
                    <div className="flex gap-2 mb-6"><input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white dark:bg-slate-800 outline-none text-sm shadow-inner transition-colors" /><button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full font-bold shadow-lg transition-all active:scale-95">+</button></div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">{subjects.map(s => <div key={s.id} className="flex justify-between bg-white/80 dark:bg-slate-800/80 px-6 py-3 rounded-2xl font-bold border border-gray-50 dark:border-slate-700 transition-colors">{s.name}<button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300 hover:text-red-500 transition-colors">✕</button></div>)}</div>
                  </div>
                  
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-black flex items-center gap-2"><LinkIcon size={20}/> 綁定雲端解答</h2>
                        <button onClick={handleSyncCheck} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-5 py-2.5 rounded-full text-xs font-black shadow-sm hover:bg-indigo-600 hover:text-white transition-all active:scale-95"><Search size={14}/> 雲端檔案管理</button>
                      </div>

                      <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl mb-6 text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-2 border border-indigo-100 dark:border-indigo-800/50">
                        <AlertTriangle size={16} className="shrink-0"/>
                        <p>請先將 PDF 拖曳至 Google Drive 資料夾，點擊右方 <strong className="bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">🔄 刷新</strong> 按鈕，即可在此選擇並綁定。此方式不受檔案大小限制！</p>
                      </div>

                      <form onSubmit={handleBindSolution} className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                          <select name="subject" required className="w-full sm:w-1/3 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm shadow-inner transition-colors cursor-pointer dark:text-slate-200 outline-none">
                            <option value="">選擇科目</option>
                            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                          <input name="title" required placeholder="為這份解答命名 (例如：第三次段考)" className="flex-1 w-full bg-white dark:bg-slate-800 rounded-full px-6 py-3.5 font-bold text-sm shadow-inner transition-colors outline-none" />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
                          <div className="flex-1 flex w-full gap-2 items-center">
                            <select name="fileId" required className="flex-1 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold text-sm shadow-inner transition-colors cursor-pointer dark:text-slate-200 outline-none">
                              {availableFiles.length === 0 ? <option value="">無待綁定檔案，請先點擊右方刷新...</option> : <option value="">選擇已上傳的 PDF 檔案...</option>}
                              {availableFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <button type="button" onClick={fetchDriveFiles} className="bg-white dark:bg-slate-800 p-3.5 rounded-full shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-500 flex-shrink-0 active:scale-95">
                              <RefreshCw size={18} className={isFetchingDrive ? "animate-spin text-indigo-500" : ""} />
                            </button>
                          </div>
                          
                          <button disabled={isUploading || availableFiles.length === 0} className="w-full sm:w-auto bg-indigo-600 text-white font-black py-3.5 px-10 rounded-full shadow-lg disabled:opacity-50 text-sm transition-all active:scale-95 whitespace-nowrap flex-shrink-0">
                            {isUploading ? "處理中..." : "綁定至系統"}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                      <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-black">📚 解答資料庫</h2><select value={sortMethod} onChange={e => setSortMethod(e.target.value)} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full font-bold text-[10px] border dark:border-slate-700 shadow-sm transition-colors cursor-pointer"><option value="time">最新上傳</option><option value="subject">科目排序</option></select></div>
                      <div className="space-y-3">{solutions.map(sol => <div key={sol.id} className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 px-8 py-5 rounded-[2.5rem] shadow-sm border border-white dark:border-slate-700/50 group hover:bg-white/95 transition-all"><span className="font-bold text-sm"><span className="text-indigo-500 mr-3 text-[10px] bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full uppercase tracking-wider">[{sol.subject}]</span>{sol.title}</span><div className="flex gap-2"><button onClick={() => setViewingPreviewUrl(sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : `https://drive.google.com/file/d/${sol.drive_file_id}/preview`)} className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-teal-500 hover:text-white transition-all">預覽</button><button onClick={() => handleFullDelete(sol)} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white transition-all">刪除</button></div></div>)}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div className="flex flex-col gap-8">
                  {/* 🚀 學生與系統設定整合區塊 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* 新增學生建檔 */}
                    <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] shadow-xl border border-white dark:border-slate-700/50 flex flex-col justify-center transition-colors relative">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="font-black text-sm flex items-center gap-2"><PlusCircle size={18} className="text-teal-500"/> 新增學生建檔</h2>
                        <button onClick={fetchAdminData} className="flex items-center gap-2 bg-teal-50 dark:bg-teal-500/10 text-teal-600 px-4 py-2 rounded-full text-[10px] font-bold shadow-sm hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all active:scale-95"><RefreshCw size={12}/> 刷新名單</button>
                      </div>
                      <div className="flex gap-3">
                        <input type="number" value={newSeat} onChange={e => setNewSeat(e.target.value)} placeholder="座號" className="w-24 bg-white dark:bg-slate-800 rounded-full px-4 py-3 font-bold text-sm shadow-inner transition-colors outline-none" />
                        <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="學生姓名" className="flex-1 bg-white dark:bg-slate-800 rounded-full px-4 py-3 font-bold text-sm shadow-inner transition-colors outline-none" />
                        <button onClick={handleAddStudent} className="bg-teal-500 hover:bg-teal-400 text-white px-5 py-3 rounded-full font-black text-sm shadow-lg transition-all active:scale-95">新增</button>
                      </div>
                    </div>

                    {/* 維護模式 */}
                    <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] shadow-xl border border-white dark:border-slate-700/50 flex flex-col justify-center gap-4 transition-colors">
                      <div className="flex items-center gap-4"><div className={`p-3 rounded-2xl shrink-0 ${maintenance.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}><ShieldCheck size={24} /></div><div><h3 className="font-black text-sm italic">維護系統狀態</h3><p className="text-[10px] text-slate-500">{maintenance.active ? `維護中 (已允許 ${maintenance.testers.length} 名測試員)` : '正常運作中'}</p></div></div>
                      <button onClick={() => { if(maintenance.active) setDoc(doc(db,"settings","maintenance"),{active:false,testers:[]}).then(() => fetchMaintenanceStatus()); else setShowTesterModal(true); }} className={`w-full py-3 rounded-full font-black text-xs shadow-md transition-all ${maintenance.active ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>{maintenance.active ? '關閉維護開放登入' : '啟動維護模式'}</button>
                    </div>

                    {/* 🚀 新增：版本發佈中心 */}
                    <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] shadow-xl border border-white dark:border-slate-700/50 flex flex-col justify-center transition-colors lg:col-span-3 xl:col-span-1">
                      <h2 className="font-black text-sm mb-4 flex items-center gap-2 text-indigo-500"><Sparkles size={18}/> 發佈系統更新日誌</h2>
                      <div className="flex flex-col gap-3">
                        <input value={systemVersion} onChange={e => setSystemVersion(e.target.value)} placeholder="版本號 (例: v2.0.0)" className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-2.5 font-bold text-xs shadow-inner transition-colors outline-none" />
                        <textarea value={systemNotes} onChange={e => setSystemNotes(e.target.value)} placeholder="輸入更新內容，可換行分隔多個亮點..." rows={2} className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-3 font-bold text-xs shadow-inner transition-colors outline-none resize-none custom-scrollbar" />
                        <button onClick={handlePublishUpdate} className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-2.5 rounded-full font-black text-xs shadow-md transition-all active:scale-95">推播更新至學生端</button>
                      </div>
                    </div>

                  </div>

                  <div className="bg-white/70 dark:bg-slate-900/50 p-12 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">{students.map(s => (
                      <div key={s.id} className={`bg-white/90 dark:bg-slate-800/90 p-8 rounded-[3rem] flex flex-col items-center shadow-lg border-2 relative transition-all ${maintenance.active && maintenance.testers.includes(Number(s.seat_number)) ? 'border-orange-400' : 'border-transparent'}`}>
                        <button onClick={() => { setEditingStudent(s); setEditName(s.name); }} className="absolute top-5 right-5 text-slate-300 hover:text-teal-500 transition-colors bg-white/50 dark:bg-slate-800/50 p-2 rounded-xl backdrop-blur-sm"><Edit2 size={16} /></button>
                        <div className="relative mb-6">
                          <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden"><img src={s.photo_url ? `${s.photo_url}?t=${lastFetchTime}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                          <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[12px] font-black w-8 h-8 flex items-center justify-center rounded-full border-4 border-white dark:border-slate-700 shadow-md">{s.seat_number}</div>
                        </div>
                        <div className="font-black text-xl mb-6 dark:text-white">{s.name}</div>
                        <div className="flex flex-col w-full gap-3 border-t dark:border-slate-700 pt-6 mt-auto">
                          <button onClick={() => setSelectedStudent(s)} className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-black py-3.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Eye size={16}/> 觀看紀錄</button>
                          {s.bound_uid ? <button onClick={() => { if(confirm("確定解除連動？")) writeBatch(db).update(doc(db,"students",s.id),{bound_uid:null,bound_email:null,photo_url:null}).delete(doc(db,"users",s.bound_uid)).commit().then(fetchAdminData); }} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-black py-3.5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm">解除連動</button> : <button onClick={() => { const u = prompt(`座號 ${s.seat_number} 的 UID：`); if(u) setDoc(doc(db,"users",u.trim()),{role:"student",seat_number:Number(s.seat_number)},{merge:true}).then(() => updateDoc(doc(db,"students",s.id),{bound_uid:u.trim()})).then(fetchAdminData); }} className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-black py-3.5 rounded-full hover:bg-teal-500 hover:text-white border border-teal-100 transition-all">手動綁定</button>}
                        </div>
                      </div>
                    ))}</div>
                  </div>
                </div>
              )}

              {/* Reports 保持不變... 為了節省篇幅直接套用上一版的即可 */}
              {activeTab === "reports" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-10 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 h-[450px] flex flex-col items-center transition-colors"><div className="flex justify-between w-full mb-6"><h2 className="text-lg font-black flex items-center gap-2"><BarChart3 size={20}/> 熱度分析</h2><div className="flex gap-2"><button onClick={fetchAdminData} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 px-4 py-2 rounded-full text-[10px] font-bold shadow-sm active:scale-95"><RefreshCw size={12}/> 刷新</button><button onClick={handleDataRepair} className="bg-red-50 dark:bg-red-500/10 text-red-600 px-4 py-2 rounded-full text-[10px] font-bold border border-red-100 shadow-sm hover:bg-red-100 transition-all active:scale-95"><AlertTriangle size={12}/> 強制校正</button></div></div><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={subjects.map(sub => ({ name: sub.name, value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + (s.view_count || 0), 0) })).filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" cornerRadius={10} paddingAngle={5}>{COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff' }} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div>
                  <div className="bg-white/70 dark:bg-slate-900/50 p-10 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 overflow-y-auto max-h-[450px] custom-scrollbar transition-colors"><h2 className="text-lg font-black mb-8 flex items-center gap-3 dark:text-slate-100"><Trophy size={22} className="text-yellow-500" /> 熱門排行榜</h2>{[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,8).map((sol, i) => (<div key={sol.id} className="flex justify-between items-center p-5 bg-white/60 dark:bg-slate-800/60 rounded-[2rem] mb-4 shadow-sm border border-white/50 group hover:bg-white dark:hover:bg-slate-800 transition-colors"><span className="font-black text-gray-700 dark:text-slate-200 text-sm flex items-center"><span className={`w-8 h-8 flex items-center justify-center rounded-xl mr-4 text-xs text-white shadow-md ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-300' : 'bg-indigo-300'}`}>{i+1}</span>{sol.title}</span><span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1 rounded-full text-xs">{sol.view_count || 0}</span></div>))}</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* 所有的 Modals (編輯姓名、比對、維護、觀看紀錄) 保持不變，直接套用上一版 */}
      {/* ... 省略以避免過長 ... */}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  );
}
