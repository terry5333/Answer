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
        alert("權限不足，僅限老師進入");
        router.push("/dashboard"); 
        return; 
      }
      fetchAdminData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 🚀 核心：獲取/重新整理所有數據
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
      
      console.log("數據已更新");
    } catch (e) { console.error("獲取資料失敗", e); }
  };

  // 🚀 上傳解答邏輯
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

    if (!file || !subject || !title || !folderId) {
      alert("請填寫完整資訊並確認環境變數！");
      setIsUploading(false);
      return;
    }

    try {
      const tokenRes = await fetch('/api/auth/google-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error("取得授權失敗");

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
      if (!driveRes.ok) throw new Error(driveData.error?.message || 'Drive 上傳失敗');

      await addDoc(collection(db, "solutions"), {
        subject,
        title,
        drive_file_id: driveData.id,
        view_count: 0,
        created_at: serverTimestamp()
      });

      alert("✅ 解答上傳成功！");
      fetchAdminData();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      alert(`❌ 失敗: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("確定刪除此科目？")) return;
    await deleteDoc(doc(db, "subjects", id));
    fetchAdminData();
  };

  const handleDeleteSolution = async (id: string) => {
    if (!confirm("確定刪除這份解答？")) return;
    await deleteDoc(doc(db, "solutions", id));
    fetchAdminData();
  };

  const handleDeleteLog = async (logId: string, solutionId: string) => {
    if (!confirm("確定刪除紀錄並扣回次數？")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "view_logs", logId));
      batch.update(doc(db, "solutions", solutionId), { view_count: increment(-1) });
      await batch.commit();
      
      // 本地同步
      setViewLogs(prev => prev.filter(l => l.id !== logId));
      setSolutions(prev => prev.map(s => s.id === solutionId ? { ...s, view_count: Math.max(0, (s.view_count || 1) - 1) } : s));
    } catch (e) { alert("操作失敗"); }
  };

  const handleUnbind = async (seatId: string, uid: string) => {
    if (!confirm("確定解除該座號綁定？")) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
    batch.delete(doc(db, "users", uid));
    await batch.commit();
    fetchAdminData();
  };

  const handleManualBind = async (seatId: string) => {
    const uid = prompt(`輸入 ${seatId} 號學生的 UID：`);
    if (!uid) return;
    await updateDoc(doc(db, "students", seatId), { bound_uid: uid.trim() });
    await setDoc(doc(db, "users", uid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
    fetchAdminData();
  };

  const sortedSolutions = [...solutions].sort((a, b) => 
    sortMethod === "subject" ? a.subject.localeCompare(b.subject, 'zh-TW') : 0
  );

  const subjectChartData = subjects.map(sub => ({
    name: sub.name,
    value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + Math.max(0, s.view_count || 0), 0)
  })).filter(d => d.value > 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <svg className="animate-spin h-10 w-10 text-indigo-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24 relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-xl md:text-2xl font-black text-indigo-900">👨‍🏫 TerryEdu 管理中控台</h1>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-red-400 text-white px-5 py-2.5 rounded-full font-bold shadow-md active:scale-95 transition-all">登出</button>
        </div>

        {/* Navbar */}
        <div className="flex justify-center gap-2 md:gap-4 bg-white/60 p-3 rounded-full shadow-lg sticky top-4 z-40 overflow-x-auto border border-white/50">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📘 解答管理</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>👥 學生名單</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📊 數據統計</button>
        </div>

        {!isVerified ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 shadow-xl border border-white text-center">
              <h2 className="text-xl font-bold mb-6 text-indigo-900">管理員身份驗證</h2>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
            </div>
          </div>
        ) : (
          <>
            {/* 📘 解答管理頁籤 */}
            {activeTab === "solutions" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                <div className="bg-white/60 rounded-[3rem] p-8 shadow-lg h-fit border border-white">
                  <h2 className="text-xl font-bold mb-6 text-gray-800">🏷️ 科目設定</h2>
                  <div className="flex gap-2 mb-6">
                    <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目" className="flex-1 rounded-full px-4 py-2 border outline-none focus:ring-2 focus:ring-indigo-300" />
                    <button onClick={async () => { if(newSubject){ await addDoc(collection(db,"subjects"),{name:newSubject}); setNewSubject(""); fetchAdminData(); }}} className="bg-indigo-600 text-white px-5 rounded-full font-bold">+</button>
                  </div>
                  <div className="space-y-2">
                    {subjects.map(s => <div key={s.id} className="flex justify-between bg-white/50 px-5 py-2 rounded-full font-bold text-gray-700 shadow-sm">{s.name}<button onClick={() => handleDeleteSubject(s.id)} className="text-red-400 hover:text-red-600">✕</button></div>)}
                  </div>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* 📤 上傳區 (找回來了) */}
                  <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white">
                    <h2 className="text-xl font-bold mb-6 text-gray-800">📤 上傳新解答</h2>
                    <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
                      <select name="subject" required className="w-full sm:w-1/3 bg-white border rounded-full px-4 py-3 font-bold outline-none cursor-pointer">
                        <option value="">選擇科目</option>
                        {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <input name="title" required placeholder="解答標題" className="flex-1 w-full bg-white border rounded-full px-5 py-3 font-bold outline-none" />
                      <input type="file" name="file" required className="text-xs text-gray-500 w-full sm:w-auto" />
                      <button disabled={isUploading} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-full shadow-md active:scale-95 disabled:opacity-50 w-full sm:w-auto">
                        {isUploading ? "上傳中..." : "上傳"}
                      </button>
                    </form>
                  </div>

                  {/* 📚 列表區 */}
                  <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-800">📚 已上傳解答</h2>
                      <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white/70 px-4 py-2 rounded-full font-bold border text-sm outline-none">
                        <option value="time">🕒 依上傳時間</option>
                        <option value="subject">🏷️ 依科目排序</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      {sortedSolutions.map(sol => (
                        <div key={sol.id} className="flex justify-between items-center bg-white/50 px-6 py-4 rounded-full shadow-sm hover:bg-white/80 transition-all">
                          <span className="font-bold text-gray-700"><span className="text-indigo-500 mr-2 tracking-widest">[{sol.subject}]</span>{sol.title}</span>
                          <button onClick={() => handleDeleteSolution(sol.id)} className="text-red-500 text-sm font-bold hover:underline">刪除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 👥 學生管理頁籤 */}
            {activeTab === "students" && (
              <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white animate-in fade-in duration-500">
                <h2 className="text-xl font-bold mb-6 text-gray-800">🧑‍🎓 學生綁定管理</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {students.map(student => (
                    <div key={student.id} className="bg-white/50 p-5 rounded-[2rem] flex flex-col justify-between shadow-sm border border-transparent hover:border-white transition-all">
                      <div onClick={() => setSelectedStudent(student)} className="cursor-pointer flex flex-col items-center mb-4 group">
                        <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} className="w-14 h-14 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                        <div className="font-bold mt-2 text-gray-700">{student.seat_number} 號 {student.name}</div>
                      </div>
                      {student.bound_uid ? (
                        <div className="flex flex-col gap-2 pt-3 border-t">
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full text-center">已綁定 Google</span>
                          <button onClick={() => handleUnbind(student.id, student.bound_uid)} className="text-xs text-red-500 font-bold hover:underline">解除綁定</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-3 border-t">
                          <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-3 py-1 rounded-full text-center">未綁定</span>
                          <button onClick={() => handleManualBind(student.id)} className="text-xs text-indigo-500 font-bold hover:underline">手動輸入 UID</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 📊 數據統計頁籤 */}
            {activeTab === "reports" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
                <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg h-[450px] flex flex-col border border-white relative">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">📊 點擊佔比統計</h2>
                    {/* 🚀 新增：重新整理按鈕 */}
                    <button onClick={fetchAdminData} className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95 shadow-sm">
                      🔄 重新整理數據
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" stroke="none">
                        {subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white overflow-y-auto max-h-[450px]">
                  <h2 className="text-xl font-bold mb-6 text-gray-800">🔥 熱門解答排行榜</h2>
                  {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, i) => (
                    <div key={sol.id} className="flex justify-between items-center p-4 bg-white/50 rounded-[1.5rem] mb-3 shadow-sm border border-white/50 group hover:bg-white transition-all">
                      <span className="font-bold text-gray-700 flex items-center">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 text-[10px] text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-orange-300' : 'bg-indigo-200'}`}>
                          {i+1}
                        </span>
                        {sol.title}
                      </span>
                      <span className="text-orange-500 font-black bg-orange-50 px-4 py-1 rounded-full text-sm">{sol.view_count || 0} 次</span>
                    </div>
                  ))}
                  {solutions.length === 0 && <div className="text-center py-20 text-gray-400 italic">目前尚無數據</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 觀看細節 Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[3rem] p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <img src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} className="w-12 h-12 rounded-full shadow-sm border border-white" />
                <h3 className="text-2xl font-black text-gray-800">{selectedStudent.seat_number} 號 {selectedStudent.name} 的觀看紀錄</h3>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-gray-100 hover:bg-red-500 hover:text-white rounded-full font-bold transition-all shadow-sm">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 pr-2 custom-scrollbar">
              {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                const s = solutions.find(sol => sol.id === log.solution_id);
                return (
                  <div key={log.id} className="group bg-white/70 p-5 rounded-[2rem] flex justify-between items-center shadow-sm border border-white/50 hover:bg-white transition-all">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 text-sm md:text-base">
                        {s ? <><span className="text-indigo-400 mr-2">[{s.subject}]</span>{s.title}</> : <span className="text-gray-400 italic">已刪除解答</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-1 font-medium bg-gray-50 self-start px-2 py-0.5 rounded-full border border-gray-100">
                        {log.viewed_at?.toDate().toLocaleString() || "剛剛"}
                      </span>
                    </div>
                    {/* 🚀 刪除紀錄並扣回次數按鈕 */}
                    <button 
                      onClick={() => handleDeleteLog(log.id, log.solution_id)} 
                      className="bg-red-50 text-red-500 text-[10px] md:text-xs px-4 py-2 rounded-full font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 sm:opacity-0 group-hover:opacity-100"
                    >
                      刪除紀錄
                    </button>
                  </div>
                );
              })}
              {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).length === 0 && (
                <div className="text-center py-20 text-gray-400 font-medium italic">目前還沒有任何觀看紀錄</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
