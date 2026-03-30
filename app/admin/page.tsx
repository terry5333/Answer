"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase"; 
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Users, BarChart3, Book, AlertTriangle, Eye, Sun, Moon, BookOpen, ShieldCheck, Search, Trash2, CheckCircle, Trophy, PlusCircle, Edit2, Link as LinkIcon, Sparkles } from "lucide-react";
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
    const subSnap = await getDocs(collection(db, "subjects"));
    const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("created_at", "desc")));
    const stuSnap = await getDocs(query(collection(db, "students"), orderBy("seat_number", "asc")));
    const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc")));
    setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setStudents(stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchSystemSettings = async () => {
    const mSnap = await getDoc(doc(db, "settings", "maintenance"));
    if (mSnap.exists()) { setMaintenance({ active: mSnap.data().active, testers: mSnap.data().testers || [] }); setSelectedTesters(mSnap.data().testers || []); }
    const vSnap = await getDoc(doc(db, "settings", "changelog"));
    if (vSnap.exists()) { setSystemVersion(vSnap.data().version || "v2.0.0"); setSystemNotes(vSnap.data().notes || ""); }
  };

  const handlePublishUpdate = async () => {
    await setDoc(doc(db, "settings", "changelog"), { version: systemVersion.trim(), notes: systemNotes.trim(), updated_at: serverTimestamp() });
    alert("✅ V2 更新已發佈！");
  };

  const fetchDriveFiles = async () => {
    setIsFetchingDrive(true);
    const res = await fetch('/api/upload', { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "LIST_FILES" }) });
    const data = await res.json();
    if (data.status === 'success') {
      const dbFileIds = solutions.map(sol => sol.drive_file_id || (sol.file_url?.match(/[-\w]{25,35}/)?.[0])).filter(Boolean);
      setAvailableFiles(data.files.filter((f: any) => !dbFileIds.includes(f.id)));
    }
    setIsFetchingDrive(false);
  };

  const handleBindSolution = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fileId = formData.get('fileId') as string;
    const selectedFile = availableFiles.find(f => f.id === fileId);
    if (!selectedFile) return;
    setIsUploading(true);
    await addDoc(collection(db, "solutions"), { subject: formData.get('subject'), title: formData.get('title'), file_url: selectedFile.url, drive_file_id: selectedFile.id, view_count: 0, created_at: serverTimestamp() });
    setAvailableFiles(prev => prev.filter(f => f.id !== fileId));
    await fetchAdminData();
    setIsUploading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><RefreshCw className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">T</div><h1 className="text-xl font-black italic">TerryEdu Admin</h1></div>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-slate-200 dark:bg-slate-800 px-6 py-2.5 rounded-full font-bold text-sm">登出</button>
        </div>

        <div className="flex justify-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-full shadow-lg border">
          {[{id:"solutions",label:"解答",icon:<Book size={16}/>,color:"bg-indigo-600"},{id:"students",label:"學生系統",icon:<Users size={16}/>,color:"bg-teal-600"},{id:"reports",label:"報表",icon:<BarChart3 size={16}/>,color:"bg-orange-500"}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === t.id ? `text-white ${t.color}` : "text-gray-500"}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "solutions" && (
            <motion.div key="sol" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] border">
                <h2 className="text-lg font-black mb-6">科目設定</h2>
                <div className="flex gap-2 mb-6">
                  <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white dark:bg-slate-800 outline-none" />
                  <button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full">+</button>
                </div>
                <div className="space-y-2">{subjects.map(s => <div key={s.id} className="flex justify-between bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl font-bold">{s.name}<button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300 hover:text-red-500">✕</button></div>)}</div>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] border shadow-xl">
                  <h2 className="text-lg font-black mb-6 flex items-center gap-2"><LinkIcon size={20}/> 綁定雲端解答</h2>
                  <form onSubmit={handleBindSolution} className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <select name="subject" required className="flex-1 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold"><option value="">選擇科目</option>{subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                      <input name="title" required placeholder="解答名稱" className="flex-1 bg-white dark:bg-slate-800 rounded-full px-6 py-3.5 font-bold" />
                    </div>
                    <div className="flex gap-2">
                      <select name="fileId" required className="flex-1 bg-white dark:bg-slate-800 rounded-full px-5 py-3.5 font-bold">{availableFiles.length === 0 ? <option value="">無待綁定檔案</option> : <option value="">選擇雲端檔案...</option>}{availableFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                      <button type="button" onClick={fetchDriveFiles} className="bg-white dark:bg-slate-800 p-3.5 rounded-full"><RefreshCw size={18} className={isFetchingDrive ? "animate-spin" : ""} /></button>
                      <button disabled={isUploading} className="bg-indigo-600 text-white font-black px-10 rounded-full">{isUploading ? "..." : "綁定"}</button>
                    </div>
                  </form>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/50 p-8 rounded-[3rem] border shadow-xl">
                  <h2 className="text-lg font-black mb-6">解答清單</h2>
                  <div className="space-y-3">{solutions.map(sol => <div key={sol.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-5 rounded-[2rem] border group hover:bg-white transition-all"><span className="font-bold text-sm"><span className="text-indigo-500 mr-2">[{sol.subject}]</span>{sol.title}</span><button onClick={() => deleteDoc(doc(db,"solutions",sol.id)).then(fetchAdminData)} className="bg-red-50 text-red-500 px-4 py-2 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all">刪除</button></div>)}</div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "students" && (
            <motion.div key="stu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border flex flex-col justify-center gap-4 transition-colors">
                  <div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${maintenance.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}><ShieldCheck size={24} /></div><div><h3 className="font-black text-sm italic">維護狀態</h3><p className="text-[10px] text-slate-500">{maintenance.active ? `維護中` : '正常'}</p></div></div>
                  <button onClick={() => { if(maintenance.active) setDoc(doc(db,"settings","maintenance"),{active:false,testers:[]}).then(() => fetchSystemSettings()); else setShowTesterModal(true); }} className={`w-full py-3 rounded-full font-black text-xs ${maintenance.active ? 'bg-slate-200' : 'bg-orange-500 text-white'}`}>{maintenance.active ? '關閉維護' : '啟動維護'}</button>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border flex flex-col justify-center lg:col-span-2">
                  <h2 className="font-black text-sm mb-4 text-indigo-500 flex items-center gap-2"><Sparkles size={18}/> V2 系統發佈公告</h2>
                  <div className="flex flex-col gap-3"><input value={systemVersion} onChange={e => setSystemVersion(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-2 font-bold text-xs" /><textarea value={systemNotes} onChange={e => setSystemNotes(e.target.value)} rows={2} className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-xs resize-none" /><button onClick={handlePublishUpdate} className="bg-indigo-600 text-white w-full py-2 rounded-full font-black text-xs">發佈更新日誌</button></div>
                </div>
              </div>
              <div className="bg-white/70 dark:bg-slate-900/50 p-12 rounded-[3.5rem] border shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">{students.map(s => (
                  <div key={s.id} className="bg-white/90 dark:bg-slate-800/90 p-8 rounded-[3rem] flex flex-col items-center border relative transition-all">
                    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden mb-4"><img src={s.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} className="w-full h-full object-cover" /></div>
                    <div className="font-black text-lg">{s.seat_number} 號 {s.name}</div>
                  </div>
                ))}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
