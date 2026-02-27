"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
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
  
  // 🚀 修正：補回漏掉的狀態與設定
  const [newSubject, setNewSubject] = useState(""); // 處理新增科目輸入
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
      if (!snap.exists() || snap.data().role !== "teacher") { router.push("/dashboard"); return; }
      fetchAdminData();
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
    } catch (e) { console.error("獲取資料失敗", e); }
  };

  // 🚀 修正：補回刪除科目的函數
  const handleDeleteSubject = async (id: string) => {
    if (!confirm("確定要刪除此科目嗎？這不會刪除已上傳的解答，但篩選功能可能會受影響。")) return;
    try {
      await deleteDoc(doc(db, "subjects", id));
      setSubjects(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("刪除失敗"); }
  };

  // 🚀 修正：補回刪除解答的函數
  const handleDeleteSolution = async (id: string) => {
    if (!confirm("確定要刪除這份解答紀錄嗎？")) return;
    try {
      await deleteDoc(doc(db, "solutions", id));
      setSolutions(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("刪除失敗"); }
  };

  const handleDeleteLog = async (logId: string, solutionId: string) => {
    if (!confirm("確定刪除這筆紀錄嗎？系統將同步扣回解答點擊次數。")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "view_logs", logId));
      batch.update(doc(db, "solutions", solutionId), { view_count: increment(-1) });
      await batch.commit();

      setViewLogs(prev => prev.filter(l => l.id !== logId));
      setSolutions(prev => prev.map(s => s.id === solutionId ? { ...s, view_count: Math.max(0, (s.view_count || 1) - 1) } : s));
      alert("✅ 已刪除紀錄並扣回次數");
    } catch (e) { alert("刪除失敗"); }
  };

  const handleUnbind = async (seatId: string, uid: string) => {
    if (!confirm("確定解除綁定？")) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
      batch.delete(doc(db, "users", uid));
      await batch.commit();
      fetchAdminData();
    } catch (e) { alert("解除綁定失敗"); }
  };

  const handleManualBind = async (seatId: string) => {
    const uid = prompt(`輸入 ${seatId} 號學生的 Google UID：`);
    if (!uid) return;
    try {
      await updateDoc(doc(db, "students", seatId), { bound_uid: uid.trim() });
      await setDoc(doc(db, "users", uid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
      fetchAdminData();
    } catch (e) { alert("手動綁定失敗"); }
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-indigo-900">👨‍🏫 老師中控台</h1>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-red-400 text-white px-5 py-2.5 rounded-full font-bold shadow-md">登出</button>
        </div>

        <div className="flex justify-center gap-4 bg-white/60 p-3 rounded-full shadow-lg sticky top-4 z-40 overflow-x-auto whitespace-nowrap border border-white/50">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📘 解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>👥 學生</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📊 報表</button>
        </div>

        {!isVerified ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 shadow-xl text-center border border-white">
              <h1 className="text-xl font-bold mb-6 text-gray-800">管理員驗證</h1>
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
            </div>
          </div>
        ) : (
          <>
            {activeTab === "solutions" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="bg-white/60 rounded-[3rem] p-8 shadow-lg h-fit border border-white">
                  <h2 className="text-xl font-bold mb-6">🏷️ 科目設定</h2>
                  <div className="flex gap-2 mb-6">
                    <input 
                      value={newSubject} 
                      onChange={(e) => setNewSubject(e.target.value)} 
                      placeholder="新增科目" 
                      className="flex-1 rounded-full px-4 py-2 border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-300 transition-all" 
                    />
                    <button 
                      onClick={async () => { 
                        if(newSubject) { 
                          await addDoc(collection(db, "subjects"), { name: newSubject }); 
                          setNewSubject(""); 
                          fetchAdminData(); 
                        } 
                      }} 
                      className="bg-indigo-600 text-white px-5 rounded-full font-bold active:scale-95 transition-all"
                    >+</button>
                  </div>
                  <div className="space-y-2">
                    {subjects.map(s => (
                      <div key={s.id} className="flex justify-between bg-white/50 px-4 py-2 rounded-full font-bold shadow-sm">
                        {s.name}
                        <button onClick={() => handleDeleteSubject(s.id)} className="text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-8">
                  <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                      <h2 className="text-xl font-bold">📚 已上傳解答</h2>
                      <select 
                        value={sortMethod} 
                        onChange={(e) => setSortMethod(e.target.value)} 
                        className="bg-white/70 px-4 py-2 rounded-full font-bold outline-none border border-gray-200 text-sm shadow-sm"
                      >
                        <option value="time">🕒 最新時間</option>
                        <option value="subject">🏷️ 依科目排序</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      {sortedSolutions.map(sol => (
                        <div key={sol.id} className="flex justify-between items-center bg-white/50 px-6 py-4 rounded-full shadow-sm hover:bg-white/80 transition-all">
                          <span className="font-bold text-gray-700">
                            <span className="text-indigo-500 mr-2 tracking-widest">[{sol.subject}]</span>{sol.title}
                          </span>
                          <button onClick={() => handleDeleteSolution(sol.id)} className="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-1 rounded-full transition-all">刪除</button>
                        </div>
                      ))}
                      {sortedSolutions.length === 0 && <div className="text-center py-10 text-gray-400">尚未上傳任何解答</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "students" && (
              <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white animate-in fade-in">
                <h2 className="text-xl font-bold mb-6">🧑‍🎓 學生名單與綁定狀態</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {students.map(student => (
                    <div key={student.id} className="bg-white/50 p-5 rounded-[2rem] flex flex-col justify-between shadow-sm border border-transparent hover:border-white transition-all">
                      <div onClick={() => setSelectedStudent(student)} className="cursor-pointer flex flex-col items-center mb-4 group">
                        <div className="relative">
                          <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} className="w-14 h-14 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full border border-white shadow-sm">{student.seat_number}</div>
                        </div>
                        <div className="font-bold mt-2 text-gray-700 group-hover:text-indigo-600 transition-colors">{student.name}</div>
                      </div>
                      {student.bound_uid ? (
                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full text-center">已綁定 Google</span>
                          <button onClick={() => handleUnbind(student.id, student.bound_uid)} className="text-xs text-red-500 font-bold hover:underline">解除綁定</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                          <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-3 py-1 rounded-full text-center">尚未綁定</span>
                          <button onClick={() => handleManualBind(student.id)} className="text-xs text-indigo-500 font-bold hover:underline">手動輸入 UID</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "reports" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg h-96 flex flex-col items-center border border-white">
                  <h2 className="text-xl font-bold mb-4">📊 點擊佔比 (各科熱度)</h2>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                        {subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white overflow-y-auto max-h-96">
                  <h2 className="text-xl font-bold mb-6">🔥 熱門解答排行</h2>
                  {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, i) => (
                    <div key={sol.id} className="flex justify-between items-center p-4 bg-white/50 rounded-full mb-3 shadow-sm border border-white/50">
                      <span className="font-bold flex items-center">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 text-xs text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-orange-300' : 'bg-indigo-200'}`}>
                          {i+1}
                        </span>
                        <span className="truncate max-w-[150px] sm:max-w-none">{sol.title}</span>
                      </span>
                      <span className="text-orange-500 font-bold bg-orange-50 px-3 py-1 rounded-full text-sm">{sol.view_count || 0} 次</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 觀看紀錄細節 Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[3rem] p-6 md:p-10 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <img src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} className="w-12 h-12 rounded-full shadow-sm border border-white" />
                <h3 className="text-2xl font-black text-gray-800">{selectedStudent.seat_number} 號 {selectedStudent.name} 紀錄</h3>
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
                    <button 
                      onClick={() => handleDeleteLog(log.id, log.solution_id)} 
                      className="bg-red-50 text-red-500 text-[10px] md:text-xs px-4 py-2 rounded-full font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
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
