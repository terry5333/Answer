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

  // 🚀 深度校正：核心邏輯
  const handleDataRepair = async () => {
    if (!confirm("確定執行「深度校正」？這將重新統計資料庫內所有紀錄。")) return;
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
      alert(`✅ 校正完成！資料庫實際紀錄共 ${allLogs.length} 筆。`);
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

  const sortedSolutions = [...solutions].sort((a, b) => 
    sortMethod === "subject" ? a.subject.localeCompare(b.subject, 'zh-TW') : 0
  );

  const subjectChartData = subjects.map(sub => ({
    name: sub.name,
    value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + Math.max(0, s.view_count || 0), 0)
  })).filter(d => d.value > 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 pb-24 relative overflow-hidden">
      {/* 🔮 動態背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 80, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-200/30 blur-[120px] rounded-full" />
        <motion.div animate={{ x: [0, -100, 0], y: [0, 80, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-teal-100/30 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 px-10 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">T</div>
            <h1 className="text-xl font-black">TerryEdu Admin</h1>
          </div>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-red-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg text-sm">登出</button>
        </motion.div>

        {/* Navbar */}
        <div className="flex justify-center gap-2 bg-white/70 backdrop-blur-md p-2 rounded-full shadow-lg sticky top-4 z-40 border border-white/50">
          {["solutions", "students", "reports"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`relative px-8 py-3 rounded-full font-bold transition-all ${activeTab === tab ? "text-white" : "text-gray-500"}`}>
              {activeTab === tab && (
                <motion.div layoutId="activeTab" className={`absolute inset-0 z-[-1] shadow-lg ${tab === 'solutions' ? 'bg-indigo-600' : tab === 'students' ? 'bg-teal-600' : 'bg-orange-500'}`} style={{ borderRadius: 9999 }} />
              )}
              {tab === "solutions" ? "📘 解答" : tab === "students" ? "👥 學生" : "📊 報表"}
            </button>
          ))}
        </div>

        {!isVerified ? (
          <div className="flex justify-center py-20"><Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.3 }}>
              
              {activeTab === "solutions" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* 左：科目 */}
                  <div className="bg-white/70 backdrop-blur-lg rounded-[3rem] p-8 shadow-xl border border-white h-fit">
                    <h2 className="text-lg font-black mb-6">🏷️ 科目設定</h2>
                    <div className="flex gap-2 mb-6">
                      <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新科目..." className="flex-1 rounded-full px-5 py-3 bg-white border outline-none text-sm" />
                      <button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); await fetchAdminData(); }}} className="bg-indigo-600 text-white w-12 h-12 rounded-full font-bold">+</button>
                    </div>
                    <div className="space-y-2">
                      {subjects.map(s => (
                        <div key={s.id} className="flex justify-between bg-white/80 px-6 py-2 rounded-2xl font-bold text-gray-700 shadow-sm border border-gray-50">
                          {s.name}
                          <button onClick={() => deleteDoc(doc(db,"subjects",s.id)).then(fetchAdminData)} className="text-red-300">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 右：上傳與列表 */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/70 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl border border-white">
                      <h2 className="text-lg font-black mb-6">📤 上傳解答</h2>
                      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
                        <select name="subject" required className="w-full sm:w-1/3 bg-white border rounded-full px-5 py-3 font-bold outline-none text-sm">
                          <option value="">選擇科目</option>
                          {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <input name="title" required placeholder="解答標題" className="flex-1 w-full bg-white border rounded-full px-6 py-3 font-bold outline-none text-sm" />
                        <button disabled={isUploading} className="bg-indigo-600 text-white font-black py-3 px-8 rounded-full shadow-lg disabled:opacity-50 text-sm">發佈</button>
                      </form>
                    </div>

                    <div className="bg-white/70 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl border border-white">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-black">📚 解答資料庫</h2>
                        <div className="flex gap-2">
                          {/* 🚀 關鍵：校正按鈕移到這裡了！ */}
                          <button onClick={handleDataRepair} className="flex items-center gap-1 bg-red-50 text-red-600 px-4 py-2 rounded-full text-[10px] font-bold border border-red-100 active:scale-95 transition-all">
                            <Wrench className="w-3 h-3"/> 深度校正
                          </button>
                          <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white px-3 py-1.5 rounded-full font-bold text-[10px] border border-gray-100">
                            <option value="time">最新</option>
                            <option value="subject">科目</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {sortedSolutions.map(sol => (
                          <div key={sol.id} className="flex justify-between items-center bg-white/80 px-6 py-4 rounded-2xl shadow-sm border border-white group">
                            <span className="font-bold text-gray-700 text-sm">
                              <span className="text-indigo-500 mr-2 text-[10px] bg-indigo-50 px-2 py-1 rounded-full">[{sol.subject}]</span>
                              {sol.title}
                            </span>
                            <button onClick={() => deleteDoc(doc(db,"solutions",sol.id)).then(fetchAdminData)} className="text-red-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all">刪除</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white">
                  <h2 className="text-xl font-black mb-10 text-center">學生身分綁定</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {students.map(student => (
                      <div key={student.id} className="bg-white/90 p-6 rounded-[2.5rem] flex flex-col items-center shadow-lg border border-white relative group">
                        <div onClick={() => setSelectedStudent(student)} className="cursor-pointer transition-transform group-hover:scale-110">
                          <img src={student.photo_url || ""} className="w-16 h-16 rounded-full border-4 border-white shadow-md" />
                          <div className="absolute top-4 right-4 bg-indigo-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{student.seat_number}</div>
                        </div>
                        <div className="font-black text-gray-800 text-sm mt-4">{student.name}</div>
                        <span className={`text-[10px] font-bold mt-2 ${student.bound_uid ? 'text-green-500' : 'text-slate-300'}`}>{student.bound_uid ? '● 已連動' : '○ 未連動'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "reports" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white h-[450px] flex flex-col items-center">
                    <div className="flex justify-between w-full mb-6">
                      <h2 className="text-lg font-black flex items-center gap-2"><BarChart3 className="w-5 h-5"/> 各科熱度</h2>
                      <button onClick={fetchAdminData} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-[10px] font-bold active:scale-95 transition-all">
                        <RefreshCw className="w-3 h-3"/> 刷新
                      </button>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" cornerRadius={10} paddingAngle={5}>
                          {subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white/70 backdrop-blur-lg p-10 rounded-[3.5rem] shadow-xl border border-white overflow-y-auto max-h-[450px]">
                    <h2 className="text-lg font-black mb-8 flex items-center gap-2">🔥 熱門解答排行</h2>
                    {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).slice(0,8).map((sol, i) => (
                      <div key={sol.id} className="flex justify-between items-center p-5 bg-white/60 rounded-[2rem] mb-4 shadow-sm">
                        <span className="font-black text-gray-700 text-sm">{i+1}. {sol.title}</span>
                        <span className="text-indigo-600 font-black bg-indigo-50 px-4 py-1 rounded-full text-xs">{sol.view_count || 0}</span>
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white/95 backdrop-blur-2xl rounded-[3rem] p-8 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative z-10">
              <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h3 className="text-xl font-black">{selectedStudent.seat_number} 號 {selectedStudent.name} 紀錄</h3>
                <button onClick={() => setSelectedStudent(null)} className="font-black">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-3">
                {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                  const s = solutions.find(sol => sol.id === log.solution_id);
                  return (
                    <div key={log.id} className="group bg-white/70 p-5 rounded-[2rem] flex justify-between items-center border border-white shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-700 text-sm">{s ? s.title : "已刪除"}</span>
                        <span className="text-[10px] text-gray-400 mt-1">{log.viewed_at?.toDate().toLocaleString()}</span>
                      </div>
                      <button onClick={() => {
                        if(confirm("確定刪除並扣回次數？")) {
                          const b = writeBatch(db);
                          b.delete(doc(db,"view_logs",log.id));
                          b.update(doc(db,"solutions",log.solution_id), {view_count: increment(-1)});
                          b.commit().then(fetchAdminData);
                        }
                      }} className="bg-red-50 text-red-500 text-[10px] px-4 py-2 rounded-full font-black opacity-0 group-hover:opacity-100 transition-all">刪除</button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
