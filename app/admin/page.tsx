"use client"; // 🚀 必須放在第一行

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase"; 
import { 
  collection, getDocs, doc, getDoc, query, orderBy, 
  addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, 
  writeBatch, increment 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, Upload, Users, BarChart3, Book, AlertTriangle, 
  Edit2, Eye, Link, Unlink, Sun, Moon, BookOpen, ShieldCheck 
} from "lucide-react";
import { useTheme } from "next-themes";

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("solutions");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  
  // 🚀 核心修復：確保狀態完整
  const [newSubject, setNewSubject] = useState(""); 
  const [maintenance, setMaintenance] = useState({ active: false, testers: [] as number[] });
  const [showTesterModal, setShowTesterModal] = useState(false);
  const [selectedTesters, setSelectedTesters] = useState<number[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortMethod, setSortMethod] = useState("time");
  
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || snap.data().role !== "teacher") { router.push("/dashboard"); return; }
      
      // 🚀 同步加載數據
      await Promise.all([fetchAdminData(), fetchMaintenanceStatus()]);
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
    } catch (e) { console.error(e); }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const mSnap = await getDoc(doc(db, "settings", "maintenance"));
      if (mSnap.exists()) {
        const data = mSnap.data();
        setMaintenance({ active: data.active, testers: data.testers || [] });
        setSelectedTesters(data.testers || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const res = await fetch('/api/upload', { 
          method: "POST", 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ fileName: file.name, base64: reader.result }) 
        });
        const data = await res.json();
        if (data.status === 'success') {
          await addDoc(collection(db, "solutions"), { 
            subject: formData.get('subject'), 
            title: formData.get('title'), 
            file_url: data.url, 
            view_count: 0, 
            created_at: serverTimestamp() 
          });
          await fetchAdminData();
          (e.target as HTMLFormElement).reset();
          alert("✅ 上傳成功");
        }
      } catch (err: any) { alert(err.message); } finally { setIsUploading(false); }
    };
  };

  const handleManualBind = async (seatId: string) => {
    const uid = prompt(`輸入 ${seatId} 號學生的 UID：`);
    if (!uid) return;
    try {
      await updateDoc(doc(db, "students", seatId), { bound_uid: uid.trim() });
      await setDoc(doc(db, "users", uid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
      await fetchAdminData();
      alert("✅ 綁定成功");
    } catch (e) { alert("失敗"); }
  };

  const handleDataRepair = async () => {
    if (!confirm("確定執行「強制校正」？")) return;
    setLoading(true);
    try {
      const logSnap = await getDocs(collection(db, "view_logs"));
      const solSnap = await getDocs(collection(db, "solutions"));
      const batch = writeBatch(db);
      const countsMap: { [key: string]: number } = {};
      solSnap.docs.forEach(d => countsMap[d.id] = 0);
      logSnap.docs.forEach(d => { if (countsMap[d.data().solution_id] !== undefined) countsMap[d.data().solution_id]++; });
      for (const id in countsMap) batch.update(doc(db, "solutions", id), { view_count: countsMap[id] });
      await batch.commit();
      await fetchAdminData();
      alert("✅ 校正完成");
    } catch (e) { alert("失敗"); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center transition-colors">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} 
        className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full shadow-[0_0_20px_rgba(79,70,229,0.3)]" 
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header Section */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl transition-colors">
          <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg">T</div><h1 className="text-xl font-black italic">TerryEdu Admin</h1></div>
          <div className="flex items-center gap-3">
            {mounted && <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800 border flex items-center justify-center shadow-sm">{resolvedTheme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}</button>}
            <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-slate-200 dark:bg-slate-800 px-6 py-2.5 rounded-full font-bold text-sm shadow-sm hover:bg-slate-300 transition-colors">登出</button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-full shadow-lg border border-white/50 dark:border-slate-700/50 sticky top-4 z-40 transition-colors">
          {[{id:"solutions",label:"解答",icon:<Book size={16}/>,color:"bg-indigo-600"},{id:"students",label:"學生",icon:<Users size={16}/>,color:"bg-teal-600"},{id:"reports",label:"報表",icon:<BarChart3 size={16}/>,color:"bg-orange-500"}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === t.id ? `text-white ${t.color}` : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {!isVerified ? (
          <div className="flex justify-center py-20"><div className="bg-white/80 dark:bg-slate-900/70 p-12 rounded-[3rem] shadow-2xl border border-white dark:border-slate-700/50 text-center"><h2 className="text-xl font-bold mb-8 text-indigo-900 dark:text-indigo-300 tracking-tight">管理員安全驗證</h2><Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} /></div></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
              
              {activeTab === "solutions" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 h-fit transition-colors">
                    <h2 className="text-lg font-black mb-6 flex items-center gap-2"><div className="w-1.5 h-5 bg-indigo-500 rounded-full" /> 科目設定</h2>
                    <div className="flex gap-2 mb-6"><input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white dark:bg-slate-800 outline-none text-sm shadow-inner transition-colors" /><button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full font-bold shadow-lg transition-all active:scale-95">+</button></div>
                    <div className="space-y-2">{subjects.map(s => <div key={s.id} className="flex justify-between bg-white/80 dark:bg-slate-800/80 px-6 py-3 rounded-2xl font-bold border border-gray-50 dark:border-slate-700 transition-colors">{s.name}<button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300 hover:text-red-500 transition-colors">✕</button></div>)}</div>
                  </div>
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                      <h2 className="text-lg font-black mb-6 flex items-center gap-2"><Upload size={20}/> 上傳解答檔案</h2>
                      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
                        <select name="subject" required className="w-full sm:w-1/3 bg-white dark:bg-slate-800 rounded-full px-5 py-3 font-bold text-sm shadow-inner transition-colors"><option value="">選擇科目</option>{subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        <input name="title" required placeholder="標題" className="flex-1 w-full bg-white dark:bg-slate-800 rounded-full px-6 py-3 font-bold text-sm shadow-inner transition-colors" /><div className="flex items-center gap-2 w-full sm:w-auto"><input type="file" name="file" required className="text-[10px] flex-1 dark:text-slate-300"/><button disabled={isUploading} className="bg-indigo-600 text-white font-black py-3 px-8 rounded-full shadow-lg disabled:opacity-50 text-sm transition-all active:scale-95">{isUploading ? "..." : "發佈"}</button></div>
                      </form>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                      <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-black">📚 解答資料庫</h2><select value={sortMethod} onChange={e => setSortMethod(e.target.value)} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full font-bold text-[10px] border dark:border-slate-700 shadow-sm transition-colors"><option value="time">最新上傳</option><option value="subject">科目排序</option></select></div>
                      <div className="space-y-3">{solutions.map(sol => (
                        <div key={sol.id} className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 px-8 py-5 rounded-[2.5rem] shadow-sm border border-white dark:border-slate-700/50 group hover:bg-white/95 transition-all">
                          <span className="font-bold text-sm"><span className="text-indigo-500 mr-3 text-[10px] bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full uppercase tracking-wider">[{sol.subject}]</span>{sol.title}</span>
                          <div className="flex gap-2">
                            <button onClick={() => setViewingPreviewUrl(sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : `https://drive.google.com/file/d/${sol.drive_file_id}/preview`)} className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-teal-500 hover:text-white dark:hover:bg-teal-500 dark:hover:text-white">預覽</button>
                            <button onClick={() => deleteDoc(doc(db,"solutions",sol.id)).then(fetchAdminData)} className="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white">刪除</button>
                          </div>
                        </div>
                      ))}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div className="flex flex-col gap-8">
                  {/* Maintenance Console */}
                  <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] shadow-xl border border-white dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-4 transition-colors">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${maintenance.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}><ShieldCheck size={24} /></div><div><h3 className="font-black text-sm italic">維護系統狀態</h3><p className="text-[10px] text-slate-500">{maintenance.active ? `維護中 (已允許 ${maintenance.testers.length} 名測試員)` : '正常運作中'}</p></div></div>
                    <button onClick={() => { if(maintenance.active) setDoc(doc(db,"settings","maintenance"),{active:false,testers:[]}).then(() => fetchMaintenanceStatus()); else setShowTesterModal(true); }} className={`px-8 py-3 rounded-full font-black text-xs shadow-lg transition-all ${maintenance.active ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>{maintenance.active ? '關閉維護' : '啟動維護'}</button>
                  </div>
                  {/* Student Cards */}
                  <div className="bg-white/70 dark:bg-slate-900/50 p-12 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 transition-colors">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">{students.map(s => (
                      <div key={s.id} className={`bg-white/90 dark:bg-slate-800/90 p-8 rounded-[3rem] flex flex-col items-center shadow-lg border-2 relative transition-all ${maintenance.active && maintenance.testers.includes(s.seat_number) ? 'border-orange-400' : 'border-transparent'}`}>
                        <div className="relative mb-6">
                          <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden"><img src={s.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} className="w-full h-full object-cover" /></div>
                          <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[12px] font-black w-8 h-8 flex items-center justify-center rounded-full border-4 border-white dark:border-slate-700 shadow-md">{s.seat_number}</div>
                        </div>
                        <div className="font-black text-xl mb-6 dark:text-white">{s.name}</div>
                        <div className="flex flex-col w-full gap-3 border-t dark:border-slate-700 pt-6 mt-auto">
                          <button onClick={() => setSelectedStudent(s)} className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-black py-3.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Eye size={16}/> 查看觀看紀錄</button>
                          {s.bound_uid ? <button onClick={() => { if(confirm("解除？")) writeBatch(db).update(doc(db,"students",s.id),{bound_uid:null,bound_email:null,photo_url:null}).delete(doc(db,"users",s.bound_uid)).commit().then(fetchAdminData); }} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-black py-3.5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm">解除連動</button> : <button onClick={() => handleManualBind(s.id)} className="bg-teal-50 text-teal-600 text-xs font-black py-3.5 rounded-full hover:bg-teal-500 hover:text-white transition-all border border-teal-100">手動綁定</button>}
                        </div>
                      </div>
                    ))}</div>
                  </div>
                </div>
              )}

              {activeTab === "reports" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 p-10 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 h-[450px] flex flex-col items-center transition-colors">
                    <div className="flex justify-between w-full mb-6"><h2 className="text-lg font-black flex items-center gap-2"><BarChart3 size={20}/> 熱度分析</h2><div className="flex gap-2"><button onClick={fetchAdminData} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 px-4 py-2 rounded-full text-[10px] font-bold shadow-sm transition-all active:scale-95"><RefreshCw size={12}/> 刷新</button><button onClick={handleDataRepair} className="bg-red-50 dark:bg-red-500/10 text-red-600 px-4 py-2 rounded-full text-[10px] font-bold border border-red-100 shadow-sm hover:bg-red-100 transition-all active:scale-95"><AlertTriangle size={12}/> 強制校正</button></div></div>
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={subjects.map(sub => ({ name: sub.name, value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + (s.view_count || 0), 0) })).filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" cornerRadius={10} paddingAngle={5}>{COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff' }} /><Legend iconType="circle" /></PieChart></ResponsiveContainer>
                  </div>
                  <div className="bg-white/70 dark:bg-slate-900/50 p-10 rounded-[3.5rem] shadow-xl border border-white dark:border-slate-700/50 overflow-y-auto max-h-[450px] custom-scrollbar transition-colors">
                    <h2 className="text-lg font-black mb-8 dark:text-slate-100">🔥 熱門排行</h2>
                    {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,8).map((sol, i) => (
                      <div key={sol.id} className="flex justify-between items-center p-5 bg-white/60 dark:bg-slate-800/60 rounded-[2rem] mb-4 shadow-sm border border-white/50 group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                        <span className="font-black text-gray-700 dark:text-slate-200 text-sm flex items-center"><span className={`w-8 h-8 flex items-center justify-center rounded-xl mr-4 text-xs text-white shadow-md ${i === 0 ? 'bg-yellow-400' : 'bg-indigo-300'}`}>{i+1}</span>{sol.title}</span>
                        <span className="text-indigo-600 font-black bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1 rounded-full text-xs">{sol.view_count || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Tester Selection Modal */}
      <AnimatePresence>
        {showTesterModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowTesterModal(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl relative z-10 border border-white/20">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-orange-500 tracking-tight italic">< ShieldCheck /> 設定測試人員</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-8 max-h-[300px] overflow-y-auto custom-scrollbar p-2">{students.map(s => (
                <button key={s.seat_number} onClick={() => setSelectedTesters(prev => prev.includes(s.seat_number) ? prev.filter(n => n !== s.seat_number) : [...prev, s.seat_number])} className={`h-12 rounded-2xl font-black text-sm border-2 transition-all ${selectedTesters.includes(s.seat_number) ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-300'}`}>{s.seat_number}</button>
              ))}</div>
              <div className="flex gap-4"><button onClick={() => setShowTesterModal(false)} className="flex-1 py-4 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">取消</button><button onClick={() => setDoc(doc(db,"settings","maintenance"),{active:true,testers:selectedTesters}).then(() => { fetchMaintenanceStatus(); setShowTesterModal(false); alert("✅ 維護已啟動"); })} className="flex-1 py-4 rounded-full font-bold bg-orange-500 text-white shadow-xl shadow-orange-500/20 active:scale-95 transition-all">啟動維護</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Logs Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md" onClick={() => setSelectedStudent(null)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] p-8 md:p-10 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative z-10 border border-white/20 transition-colors">
              <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-slate-800"><div className="flex items-center gap-4"><img src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-md" /><h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedStudent.seat_number} 號 {selectedStudent.name} 觀看紀錄</h3></div><button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full font-black text-slate-500 hover:bg-slate-200 transition-colors">✕</button></div>
              <div className="overflow-y-auto flex-1 space-y-3 pr-2 custom-scrollbar">
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                  const s = solutions.find(sol => sol.id === log.solution_id);
                  return (
                    <div key={log.id} className="group bg-white/70 dark:bg-slate-800/50 p-5 rounded-[2rem] flex justify-between items-center border border-white/50 dark:border-slate-700/50 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors">
                      <div className="flex flex-col"><span className="font-black text-gray-700 dark:text-slate-200 text-sm">{s ? s.title : "已刪除解答"}</span><span className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{log.viewed_at?.toDate().toLocaleString()}</span></div>
                      <button onClick={() => { if(confirm("刪除？")) writeBatch(db).delete(doc(db,"view_logs",log.id)).update(doc(db,"solutions",log.solution_id),{view_count:increment(-1)}).commit().then(fetchAdminData); }} className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] px-4 py-2 rounded-full font-black opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">刪除</button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-lg" onClick={() => setViewingPreviewUrl(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-5xl h-[95vh] flex flex-col relative z-10 overflow-hidden shadow-2xl border border-white/20">
              <div className="p-8 flex justify-between items-center border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20"><div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl"><BookOpen size={20} className="text-indigo-600" /></div><span className="font-black text-lg italic">正在查閱解答 (無痕預覽)</span></div><button onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded-full font-bold shadow-sm transition-all">✕</button></div>
              <iframe src={viewingPreviewUrl} className="flex-1 w-full border-none" title="PDF Preview" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  );
}
