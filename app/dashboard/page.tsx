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
import { RefreshCw, Wrench, Trash2, Upload, Users, BarChart3, Book } from "lucide-react";

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];

// 動態定義：交錯進場效果
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists() || snap.data().role !== "teacher") { 
        router.push("/dashboard"); 
        return; 
      }
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

  // 🔥 數據修復大師：強制同步觀看次數
  const handleDataRepair = async () => {
    if (!confirm("這將根據目前「瀏覽紀錄」重新統計所有解答次數，修復數據不對齊的問題，確定執行？")) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const countsMap: { [key: string]: number } = {};
      solutions.forEach(sol => { countsMap[sol.id] = 0; });
      viewLogs.forEach(log => {
        if (countsMap[log.solution_id] !== undefined) countsMap[log.solution_id] += 1;
      });
      for (const solId in countsMap) {
        batch.update(doc(db, "solutions", solId), { view_count: countsMap[solId] });
      }
      await batch.commit();
      await fetchAdminData();
      alert("✅ 數據校正成功！");
    } catch (e) { alert("修復失敗"); } finally { setLoading(false); }
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
      alert("✅ 上傳成功並對接 Google Drive");
    } catch (error: any) { alert("上傳失敗"); } finally { setIsUploading(false); }
  };

  const handleDeleteLog = async (logId: string, solutionId: string) => {
    if (!confirm("確定刪除紀錄並扣回次數？")) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, "view_logs", logId));
    batch.update(doc(db, "solutions", solutionId), { view_count: increment(-1) });
    await batch.commit();
    setViewLogs(prev => prev.filter(l => l.id !== logId));
    setSolutions(prev => prev.map(s => s.id === solutionId ? { ...s, view_count: Math.max(0, (s.view_count || 1) - 1) } : s));
  };

  const sortedSolutions = [...solutions].sort((a, b) => 
    sortMethod === "subject" ? a.subject.localeCompare(b.subject, 'zh-TW') : 0
  );

  const subjectChartData = subjects.map(sub => ({
    name: sub.name,
    value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + Math.max(0, s.view_count || 0), 0)
  })).filter(d => d.value > 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 pb-24 relative overflow-hidden text-slate-800">
      
      {/* 🔮 Vibe 背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 80, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-200/30 blur-[120px] rounded-full" />
        <motion.div animate={{ x: [0, -100, 0], y: [0, 80, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-teal-100/30 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">T</div>
            <h1 className="text-xl font-black tracking-tight">TerryEdu Admin</h1>
          </div>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-red-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg">登出</button>
        </motion.div>

        {/* Navbar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-2 bg-white/70 backdrop-blur-md p-2 rounded-full shadow-lg sticky top-4 z-40 border border-white/50">
          {[
            { id: "solutions", label: "解答", icon: <Book className="w-4 h-4"/>, color: "bg-indigo-600" },
            { id: "students", label: "學生", icon: <Users className="w-4 h-4"/>, color: "bg-teal-600" },
            { id: "reports", label: "報表", icon: <BarChart3 className="w-4 h-4"/>, color: "bg-orange-500" }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === tab.id ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className={`absolute inset-0 z-[-1] shadow-lg ${tab.color}`} style={{ borderRadius: 9999 }} transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              {tab.icon} {tab.label}
            </button>
          ))}
        </motion.div>

        {!isVerified ? (
          <div className="flex justify-center py-20">
            <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-12 shadow-2xl border border-white text-center">
              <h2 className="text-xl font-bold mb-8 text-indigo-900">安全驗證</h2>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.3 }}>
              
              {activeTab === "solutions" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/70 backdrop-blur-lg rounded-[3rem] p-8 shadow-xl border border-white h-fit">
                    <h2 className="text-lg font-black mb-6 flex items-center gap-2"><div className="w-1.5 h-5 bg-indigo-500 rounded-full" /> 科目管理</h2>
                    <div className="flex gap-2 mb-6">
                      <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white border outline-none text-sm" />
                      <button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full font-bold">+</button>
                    </div>
                    <div className="space-y-2">
                      {subjects.map(s => (
                        <div key={s.id} className="flex justify-between bg-white/80 px-6 py-3 rounded-2xl font-bold text-gray-700 shadow-sm border border-gray-50">
                          {s.name}
                          <button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/70 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl border border-white">
                      <h2 className="text-lg font-black mb-6 flex items-center gap-2"><Upload className="w-5 h-5"/> 上傳新解答</h2>
                      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
                        <select name="subject" required className="w-full sm:w-1/3 bg-white border rounded-full px-5 py-3 font-bold outline-none text-sm">
                          <option value="">選擇科目</option>
                          {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <input name="title" required placeholder="解答標題" className="flex-1 w-full bg-white border rounded-full px-6 py-3 font-bold outline-none text-sm" />
                        <input type="file" name="file" required className="text-[10px] w-full sm:w-auto" />
                        <button disabled={isUploading} className="bg-indigo-600 text-white font-black py-3.5 px-8 rounded-full shadow-lg disabled:opacity-50 text-sm">
                          {isUploading ? "..." : "發佈"}
                        </button>
                      </form>
                    </div>

                    <div className="bg-white/70 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl border border-white">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-black">📚 解答資料庫</h2>
                        <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white px-4 py-2 rounded-full font-bold text-[10px] outline-none border border-gray-100">
                          <option value="time">時間</option>
                          <option value="subject">科目</option>
                        </select>
                      </div>
                      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                        {sortedSolutions.map(sol => (
                          <motion.div key={sol.id} variants={itemVariants} className="flex justify-between items-center bg-white/80 px-8 py-5 rounded-[2.5rem] shadow-sm border border-white group">
                            <span className="font-bold text-gray-700 text-sm">
                              <span className="text-indigo-500 mr-3 text-[10px] bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-tighter">[{sol.subject}]</span>
                              {sol.title}
                            </span>
                            <button onClick={() => deleteDoc(doc(db,"solutions",sol.id)).then(fetchAdminData)} className="bg-red-50 text-red-500 text-[10px] px-4 py-2 rounded-full sm:opacity-0 group-hover:opacity-100 transition-all">刪除</button>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white">
                  <h2 className="text-xl font-black mb-10 text-center">學生身分綁定管理</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {students.map(student => (
                      <motion.div key={student.id} variants={itemVariants} className="bg-white/90 p-6 rounded-[2.5rem] flex flex-col items-center shadow-lg border border-white group">
                        <div onClick={() => setSelectedStudent(student)} className="cursor-pointer relative mb-4 transition-transform group-hover:scale-110">
                          <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} className="w-16 h-16 rounded-full border-4 border-white shadow-md" referrerPolicy="no-referrer" />
                          <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{student.seat_number}</div>
                        </div>
                        <div className="font-black text-gray-800 text-sm">{student.name}</div>
                        {student.bound_uid ? (
                          <button onClick={() => {
                            if(confirm("解除連動？")) {
                              const b = writeBatch(db);
                              b.update(doc(db,"students",student.id),{bound_uid:null,bound_email:null,photo_url:null});
                              b.delete(doc(db,"users",student.bound_uid));
                              b.commit().then(fetchAdminData);
                            }
                          }} className="text-[10px] text-red-400 mt-4 font-bold border-t w-full pt-4">解除連動</button>
                        ) : (
                          <span className="text-[10px] text-slate-300 mt-4 font-bold border-t w-full pt-4 italic text-center">未連動</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "reports" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white h-[450px] flex flex-col items-center">
                    <div className="flex justify-between w-full mb-6">
                      <h2 className="text-lg font-black flex items-center gap-2"><BarChart3 className="w-5 h-5"/> 熱度統計</h2>
                      <div className="flex gap-2">
                        <button onClick={fetchAdminData} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-[10px] font-bold shadow-sm">
                          <RefreshCw className="w-3 h-3"/> 刷新
                        </button>
                        <button onClick={handleDataRepair} className="flex items-center gap-1 bg-red-50 text-red-600 px-4 py-2 rounded-full text-[10px] font-bold shadow-sm border border-red-100">
                          <Wrench className="w-3 h-3"/> 校正數據
                        </button>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" cornerRadius={10} paddingAngle={5}>
                          {subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white overflow-y-auto max-h-[450px] custom-scrollbar">
                    <h2 className="text-lg font-black mb-8 flex items-center gap-2">🔥 解答點擊排行</h2>
                    {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,8).map((sol, i) => (
                      <div key={sol.id} className="flex justify-between items-center p-5 bg-white/60 rounded-[2rem] mb-4 shadow-sm border border-white/50 group hover:bg-white transition-all">
                        <span className="font-black text-gray-700 text-sm flex items-center">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-xl mr-4 text-xs text-white shadow-md ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-300' : 'bg-indigo-300'}`}>{i+1}</span>
                          {sol.title}
                        </span>
                        <span className="text-indigo-600 font-black bg-indigo-50 px-5 py-2 rounded-full text-xs">{sol.view_count || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* 紀錄 Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudent(null)} className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="bg-white/95 backdrop-blur-2xl rounded-[3.5rem] p-10 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white relative z-10">
              <div className="flex justify-between items-center mb-8 pb-4 border-b">
                <div className="flex items-center gap-4">
                  <img src={selectedStudent.photo_url || ""} className="w-12 h-12 rounded-full border-2 border-white shadow-md" />
                  <h3 className="text-2xl font-black">{selectedStudent.seat_number} 號 {selectedStudent.name} 的觀看紀錄</h3>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-slate-100 rounded-full font-black">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-4 pr-2 custom-scrollbar">
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                  const s = solutions.find(sol => sol.id === log.solution_id);
                  return (
                    <div key={log.id} className="group bg-white/70 p-6 rounded-[2.5rem] flex justify-between items-center border border-white shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-700 text-sm">{s ? s.title : "已刪除"}</span>
                        <span className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full self-start">{log.viewed_at?.toDate().toLocaleString()}</span>
                      </div>
                      <button onClick={() => handleDeleteLog(log.id, log.solution_id)} className="bg-red-50 text-red-500 text-[10px] px-5 py-2 rounded-full font-black sm:opacity-0 group-hover:opacity-100 transition-all active:scale-95 shadow-sm">刪除</button>
                    </div>
                  );
                })}
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).length === 0 && (
                  <div className="text-center py-20 text-gray-400 font-medium italic">目前尚無紀錄</div>
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
      `}</style>
    </div>
  );
}
