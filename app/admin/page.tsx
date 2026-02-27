"use client";

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
import { RefreshCw, Upload, Users, BarChart3, Book, AlertTriangle, Edit2, Eye, Link, Unlink, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("solutions");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  
  const [newSubject, setNewSubject] = useState(""); 
  const [isVerified, setIsVerified] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortMethod, setSortMethod] = useState("time");
  const [isUploading, setIsUploading] = useState(false);
  
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists() || snap.data().role !== "teacher") { router.push("/dashboard"); return; }
      await fetchAdminData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAdminData = async () => {
    try {
      const subSnap = await getDocs(collection(db, "subjects"));
      setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("created_at", "desc")));
      setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const stuSnap = await getDocs(query(collection(db, "students"), orderBy("seat_number", "asc")));
      setStudents(stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc")));
      setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
  };

  const handleDataRepair = async () => {
    if (!confirm("確定執行「強制校正」？這將重新統計資料庫內所有紀錄。")) return;
    setLoading(true);
    try {
      const logSnap = await getDocs(collection(db, "view_logs"));
      const solSnap = await getDocs(collection(db, "solutions"));
      const allLogs = logSnap.docs.map(d => d.data());
      const allSols = solSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const batch = writeBatch(db);
      const countsMap: { [key: string]: number } = {};

      allSols.forEach(sol => { countsMap[sol.id] = 0; });
      allLogs.forEach(log => {
        if (countsMap[log.solution_id] !== undefined) countsMap[log.solution_id] += 1;
      });

      for (const solId in countsMap) {
        batch.update(doc(db, "solutions", solId), { view_count: countsMap[solId] });
      }

      await batch.commit();
      await fetchAdminData();
      alert(`✅ 數據校正成功！目前實際紀錄共 ${allLogs.length} 筆，已全數對齊。`);
    } catch (e) { alert("校正失敗"); } finally { setLoading(false); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

    try {
      const tokenRes = await fetch('/api/auth/google-token');
      const tokenData = await tokenRes.json();
      const metadata = { name: file.name, parents: [folderId] };
      const uploadFormData = new FormData();
      uploadFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      uploadFormData.append('file', file);

      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        body: uploadFormData,
      });

      const driveData = await driveRes.json();
      await addDoc(collection(db, "solutions"), {
        subject, title, drive_file_id: driveData.id, view_count: 0, created_at: serverTimestamp()
      });
      await fetchAdminData();
      (e.target as HTMLFormElement).reset();
      alert("✅ 上傳成功");
    } catch (error: any) { alert("上傳失敗"); } finally { setIsUploading(false); }
  };

  const handleUpdateName = async (seatId: string, oldName: string) => {
    const newName = prompt(`修改 ${seatId} 號學生的姓名：`, oldName);
    if (!newName || newName.trim() === oldName) return;
    try {
      await updateDoc(doc(db, "students", seatId), { name: newName.trim() });
      await fetchAdminData();
    } catch (e) { alert("修改姓名失敗"); }
  };

  const handleManualBind = async (seatId: string) => {
    const uid = prompt(`輸入 ${seatId} 號學生的 Google UID：\n(可在 Firebase Authentication 後台查詢)`);
    if (!uid) return;
    try {
      await updateDoc(doc(db, "students", seatId), { bound_uid: uid.trim() });
      await setDoc(doc(db, "users", uid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
      await fetchAdminData();
      alert("✅ 手動綁定成功！");
    } catch (e) { alert("綁定失敗"); }
  };

  const handleUnbind = async (seatId: string, uid: string) => {
    if (!confirm(`確定要解除 ${seatId} 號學生的 Google 綁定嗎？`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
      batch.delete(doc(db, "users", uid));
      await batch.commit();
      await fetchAdminData();
    } catch (e) { alert("解除綁定失敗"); }
  };

  const handleDeleteLog = async (logId: string, solutionId: string) => {
    if (!confirm("確定刪除此紀錄？（若解答仍在，將自動扣除觀看次數）")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "view_logs", logId));
      if (solutions.some(s => s.id === solutionId)) {
        batch.update(doc(db, "solutions", solutionId), { view_count: increment(-1) });
      }
      await batch.commit();
      await fetchAdminData();
    } catch (e) { 
      console.error(e);
      alert("刪除紀錄失敗！"); 
    }
  };

  const sortedSolutions = [...solutions].sort((a, b) => 
    sortMethod === "subject" ? a.subject.localeCompare(b.subject, 'zh-TW') : 0
  );

  const subjectChartData = subjects.map(sub => ({
    name: sub.name,
    value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + Math.max(0, s.view_count || 0), 0)
  })).filter(d => d.value > 0);

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center transition-colors duration-500">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 pb-24 relative overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-500">
      
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 80, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-200/30 dark:bg-indigo-900/20 blur-[120px] rounded-full" />
        <motion.div animate={{ x: [0, -100, 0], y: [0, 80, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-teal-100/30 dark:bg-teal-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl dark:shadow-none transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-2xl flex items-center justify-center text-white font-black">T</div>
            <h1 className="text-xl font-black tracking-tight hidden sm:block text-slate-800 dark:text-slate-100">TerryEdu Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            {mounted && (
              <motion.button 
                whileTap={{ scale: 0.9 }} 
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} 
                className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800 border border-white dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-sm hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              >
                {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.button>
            )}
            <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-6 py-2.5 rounded-full font-bold shadow-sm text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">登出</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-2 rounded-full shadow-lg dark:shadow-none sticky top-4 z-40 border border-white/50 dark:border-slate-700/50 transition-colors">
          {[
            { id: "solutions", label: "解答", icon: <Book className="w-4 h-4"/>, color: "bg-indigo-600" },
            { id: "students", label: "學生", icon: <Users className="w-4 h-4"/>, color: "bg-teal-600" },
            { id: "reports", label: "報表", icon: <BarChart3 className="w-4 h-4"/>, color: "bg-orange-500" }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === tab.id ? "text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className={`absolute inset-0 z-[-1] shadow-lg ${tab.color}`} style={{ borderRadius: 9999 }} transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              {tab.icon} {tab.label}
            </button>
          ))}
        </motion.div>

        {!isVerified ? (
          <div className="flex justify-center py-20">
            <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl rounded-[3rem] p-12 shadow-2xl border border-white dark:border-slate-700/50 text-center transition-colors">
              <h2 className="text-xl font-bold mb-8 text-indigo-900 dark:text-indigo-300">管理員驗證</h2>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.3 }}>
              
              {activeTab === "solutions" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg rounded-[3rem] p-8 shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 h-fit transition-colors">
                    <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100"><div className="w-1.5 h-5 bg-indigo-500 rounded-full" /> 科目設定</h2>
                    <div className="flex gap-2 mb-6">
                      <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white dark:bg-slate-800 border-none outline-none text-sm focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/50 dark:text-white transition-all shadow-inner dark:shadow-none" />
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full font-bold shadow-lg">+</motion.button>
                    </div>
                    <div className="space-y-2">
                      {subjects.map(s => (
                        <div key={s.id} className="flex justify-between bg-white/80 dark:bg-slate-800/80 px-6 py-3 rounded-2xl font-bold text-gray-700 dark:text-slate-200 shadow-sm border border-gray-50 dark:border-slate-700 transition-colors">
                          {s.name}
                          <button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300 hover:text-red-500 transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 transition-colors">
                      <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100"><Upload className="w-5 h-5"/> 上傳新解答</h2>
                      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
                        <select name="subject" required className="w-full sm:w-1/3 bg-white dark:bg-slate-800 border-none rounded-full px-5 py-3 font-bold outline-none text-sm dark:text-white shadow-inner dark:shadow-none">
                          <option value="">選擇科目</option>
                          {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <input name="title" required placeholder="解答標題" className="flex-1 w-full bg-white dark:bg-slate-800 border-none rounded-full px-6 py-3 font-bold outline-none text-sm dark:text-white shadow-inner dark:shadow-none" />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input type="file" name="file" required className="text-[10px] flex-1 dark:text-slate-300" />
                          <motion.button disabled={isUploading} whileTap={{ scale: 0.95 }} className="bg-indigo-600 text-white font-black py-3 px-8 rounded-full shadow-lg disabled:opacity-50 text-sm">
                            {isUploading ? "..." : "發佈"}
                          </motion.button>
                        </div>
                      </form>
                    </div>

                    <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 transition-colors">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">📚 解答資料庫</h2>
                        <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full font-bold text-[10px] outline-none border border-gray-100 dark:border-slate-700 dark:text-slate-200 shadow-sm">
                          <option value="time">最新上傳</option>
                          <option value="subject">科目排序</option>
                        </select>
                      </div>
                      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                        {sortedSolutions.map(sol => (
                          <motion.div key={sol.id} variants={itemVariants} className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 px-8 py-5 rounded-[2.5rem] shadow-sm border border-white dark:border-slate-700/50 group hover:bg-white/95 dark:hover:bg-slate-800 transition-all">
                            <span className="font-bold text-gray-700 dark:text-slate-200 text-sm">
                              <span className="text-indigo-500 dark:text-indigo-400 mr-3 text-[10px] bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full uppercase">[{sol.subject}]</span>
                              {sol.title}
                            </span>
                            <button onClick={() => deleteDoc(doc(db,"solutions",sol.id)).then(fetchAdminData)} className="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white">刪除</button>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg p-8 md:p-12 rounded-[3.5rem] shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 transition-colors">
                  <h2 className="text-xl font-black mb-10 text-center flex items-center justify-center gap-3 text-slate-800 dark:text-slate-100">
                    <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" /> 學生中心與權限管理
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {students.map(student => (
                      <div key={student.id} className="bg-white/90 dark:bg-slate-800/90 p-6 rounded-[2.5rem] flex flex-col items-center shadow-lg border border-white dark:border-slate-700/50 relative hover:-translate-y-1 transition-all">
                        
                        <div className="relative mb-4">
                          <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-700 shadow-md" referrerPolicy="no-referrer" />
                          <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-700">{student.seat_number}</div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <div className="font-black text-gray-800 dark:text-slate-100 text-base">{student.name}</div>
                          <button onClick={() => handleUpdateName(student.id, student.name)} className="text-slate-300 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="修改姓名">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-col w-full gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-auto">
                          <button onClick={() => setSelectedStudent(student)} className="flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-[10px] font-bold py-2.5 rounded-full hover:bg-slate-800 dark:hover:bg-slate-600 hover:text-white transition-colors w-full shadow-sm">
                            <Eye className="w-3 h-3" /> 查看觀看紀錄
                          </button>
                          {student.bound_uid ? (
                            <button onClick={() => handleUnbind(student.id, student.bound_uid)} className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-bold py-2.5 rounded-full hover:bg-red-500 hover:text-white dark:hover:bg-red-500 transition-colors w-full shadow-sm">
                              <Unlink className="w-3 h-3" /> 解除 Google 連動
                            </button>
                          ) : (
                            <button onClick={() => handleManualBind(student.id)} className="flex items-center justify-center gap-1.5 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold py-2.5 rounded-full hover:bg-teal-500 hover:text-white dark:hover:bg-teal-500 transition-colors w-full shadow-sm border border-teal-100 dark:border-teal-500/20">
                              <Link className="w-3 h-3" /> 手動綁定 UID
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "reports" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 h-[450px] flex flex-col items-center transition-colors">
                    <div className="flex justify-between w-full mb-6">
                      <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-slate-100"><BarChart3 className="w-5 h-5"/> 熱度分析</h2>
                      <div className="flex gap-2">
                        <button onClick={fetchAdminData} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-full text-[10px] font-bold active:scale-95 transition-all shadow-sm">
                          <RefreshCw className="w-3 h-3"/> 刷新
                        </button>
                        <button onClick={handleDataRepair} className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-full text-[10px] font-bold active:scale-95 transition-all border border-red-100 dark:border-red-500/20 shadow-sm hover:bg-red-100 dark:hover:bg-red-500/20">
                          <AlertTriangle className="w-3 h-3" /> 強制校正
                        </button>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" cornerRadius={10} paddingAngle={5}>
                          {subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        {/* 🚀 修正這裡：統一使用 resolvedTheme */}
                        <Tooltip contentStyle={{ 
                          borderRadius: '2rem', border: 'none', 
                          backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : 'rgba(255, 255, 255, 0.9)', 
                          color: resolvedTheme === 'dark' ? '#f8fafc' : '#334155',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' 
                        }} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl dark:shadow-none border border-white dark:border-slate-700/50 overflow-y-auto max-h-[450px] custom-scrollbar transition-colors">
                    <h2 className="text-lg font-black mb-8 text-slate-800 dark:text-slate-100">🔥 熱門解答排行</h2>
                    {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,8).map((sol, i) => (
                      <div key={sol.id} className="flex justify-between items-center p-5 bg-white/60 dark:bg-slate-800/60 rounded-[2rem] mb-4 shadow-sm border border-white/50 dark:border-slate-700/50 group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                        <span className="font-black text-gray-700 dark:text-slate-200 text-sm flex items-center">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-xl mr-4 text-xs text-white shadow-md ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-300' : 'bg-indigo-300'}`}>{i+1}</span>
                          {sol.title}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1 rounded-full text-xs">{sol.view_count || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudent(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] p-8 md:p-10 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative z-10 border border-transparent dark:border-slate-700/50">
              <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <img src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-md" referrerPolicy="no-referrer" />
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedStudent.seat_number} 號 {selectedStudent.name} 觀看紀錄</h3>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-3 custom-scrollbar pr-2">
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                  const s = solutions.find(sol => sol.id === log.solution_id);
                  return (
                    <div key={log.id} className="group bg-white/70 dark:bg-slate-800/50 p-5 rounded-[2rem] flex justify-between items-center border border-white dark:border-slate-700/50 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-700 dark:text-slate-200 text-sm">{s ? s.title : "已刪除"}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{log.viewed_at?.toDate().toLocaleString()}</span>
                      </div>
                      <button onClick={() => handleDeleteLog(log.id, log.solution_id)} className="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] px-4 py-2 rounded-full font-black opacity-0 group-hover:opacity-100 transition-all active:scale-95">刪除</button>
                    </div>
                  );
                })}
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).length === 0 && (
                  <div className="text-center py-20 text-gray-400 dark:text-slate-500 font-medium italic">目前尚無紀錄</div>
                )}
              </div>
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
