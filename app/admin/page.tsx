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
    const subSnap = await getDocs(collection(db, "subjects"));
    setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("created_at", "desc")));
    setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    const stuSnap = await getDocs(query(collection(db, "students"), orderBy("seat_number", "asc")));
    setStudents(stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc")));
    setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // 🚀 關鍵功能：刪除單筆紀錄並扣回點擊數
  const handleDeleteLog = async (logId: string, solutionId: string) => {
    if (!confirm("確定刪除這筆紀錄嗎？系統將同步扣回解答點擊次數。")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "view_logs", logId));
      batch.update(doc(db, "solutions", solutionId), { view_count: increment(-1) });
      await batch.commit();

      // 同步本地狀態讓 UI 即時反應
      setViewLogs(prev => prev.filter(l => l.id !== logId));
      setSolutions(prev => prev.map(s => s.id === solutionId ? { ...s, view_count: Math.max(0, (s.view_count || 1) - 1) } : s));
      alert("✅ 已刪除紀錄並扣回次數");
    } catch (e) { alert("刪除失敗"); }
  };

  const handleUnbind = async (seatId: string, uid: string) => {
    if (!confirm("確定解除綁定？")) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
    batch.delete(doc(db, "users", uid));
    await batch.commit(); fetchAdminData();
  };

  const handleManualBind = async (seatId: string) => {
    const uid = prompt(`輸入 ${seatId} 號學生的 Google UID：`);
    if (!uid) return;
    await updateDoc(doc(db, "students", seatId), { bound_uid: uid.trim() });
    await setDoc(doc(db, "users", uid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
    fetchAdminData();
  };

  const sortedSolutions = [...solutions].sort((a, b) => sortMethod === "subject" ? a.subject.localeCompare(b.subject, 'zh-TW') : 0);

  const subjectChartData = subjects.map(sub => ({
    name: sub.name,
    value: solutions.filter(s => s.subject === sub.name).reduce((sum, s) => sum + Math.max(0, s.view_count || 0), 0)
  })).filter(d => d.value > 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><svg className="animate-spin h-10 w-10 text-indigo-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-indigo-900">👨‍🏫 老師中控台</h1>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="bg-red-400 text-white px-5 py-2.5 rounded-full font-bold shadow-md">登出</button>
        </div>

        <div className="flex justify-center gap-4 bg-white/60 p-3 rounded-full shadow-lg sticky top-4 z-40 overflow-x-auto whitespace-nowrap">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold ${activeTab === "solutions" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>📘 解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold ${activeTab === "students" ? "bg-teal-600 text-white" : "text-gray-600"}`}>👥 學生</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold ${activeTab === "reports" ? "bg-orange-500 text-white" : "text-gray-600"}`}>📊 報表</button>
        </div>

        {activeTab === "solutions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="bg-white/60 rounded-[3rem] p-8 shadow-lg h-fit border border-white">
              <h2 className="text-xl font-bold mb-6">🏷️ 科目設定</h2>
              <div className="flex gap-2 mb-6">
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目" className="flex-1 rounded-full px-4 py-2 border outline-none" />
                <button onClick={async () => { if(newSubject) { await addDoc(collection(db, "subjects"), { name: newSubject }); setNewSubject(""); fetchAdminData(); } }} className="bg-indigo-600 text-white px-4 rounded-full">+</button>
              </div>
              <div className="space-y-2">{subjects.map(s => <div key={s.id} className="flex justify-between bg-white/50 px-4 py-2 rounded-full font-bold">{s.name}<button onClick={() => handleDeleteSubject(s.id)} className="text-red-400">✕</button></div>)}</div>
            </div>
            <div className="lg:col-span-2 flex flex-col gap-8">
              <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">📚 解答管理</h2>
                  <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white/70 px-4 py-2 rounded-full font-bold outline-none border">
                    <option value="time">🕒 最新時間</option>
                    <option value="subject">🏷️ 依科目排序</option>
                  </select>
                </div>
                <div className="space-y-3">{sortedSolutions.map(sol => (
                  <div key={sol.id} className="flex justify-between items-center bg-white/50 px-6 py-4 rounded-full shadow-sm hover:bg-white/80 transition-all">
                    <span className="font-bold"><span className="text-indigo-500 mr-2">[{sol.subject}]</span>{sol.title}</span>
                    <button onClick={() => handleDeleteSolution(sol.id)} className="text-red-500 text-sm font-bold">刪除</button>
                  </div>
                ))}</div>
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
                    <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} className="w-14 h-14 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform" />
                    <div className="font-bold mt-2 text-gray-700">{student.seat_number} 號 {student.name}</div>
                  </div>
                  {student.bound_uid ? (
                    <div className="flex flex-col gap-2 pt-3 border-t">
                      <span className="text-[10px] text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full text-center">已綁定 Google</span>
                      <button onClick={() => handleUnbind(student.id, student.bound_uid)} className="text-xs text-red-500 font-bold">解除綁定</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pt-3 border-t">
                      <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-3 py-1 rounded-full text-center">未綁定</span>
                      <button onClick={() => handleManualBind(student.id)} className="text-xs text-indigo-500 font-bold">手動輸入 UID</button>
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
              <h2 className="text-xl font-bold mb-4">📊 點擊佔比</h2>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">{subjectChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            </div>
            <div className="bg-white/60 p-8 rounded-[3rem] shadow-lg border border-white overflow-y-auto max-h-96">
              <h2 className="text-xl font-bold mb-6">🔥 熱門解答</h2>
              {[...solutions].sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, i) => (
                <div key={sol.id} className="flex justify-between items-center p-4 bg-white/50 rounded-full mb-3 shadow-sm">
                  <span className="font-bold"><span className="mr-3 text-indigo-400">#{i+1}</span>{sol.title}</span>
                  <span className="text-orange-500 font-bold">{sol.view_count || 0} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white/90 rounded-[3rem] p-8 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h3 className="text-2xl font-bold">{selectedStudent.seat_number} 號 {selectedStudent.name} 觀看紀錄</h3>
              <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-gray-100 rounded-full font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {viewLogs.filter(l => l.seat_number === selectedStudent.seat_number).map(log => {
                const s = solutions.find(sol => sol.id === log.solution_id);
                return (
                  <div key={log.id} className="group bg-white/70 p-5 rounded-[2rem] flex justify-between items-center shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700">{s ? s.title : "已刪除解答"}</span>
                      <span className="text-[10px] text-gray-400 mt-1">{log.viewed_at?.toDate().toLocaleString()}</span>
                    </div>
                    <button onClick={() => handleDeleteLog(log.id, log.solution_id)} className="bg-red-50 text-red-500 text-xs px-4 py-2 rounded-full font-bold hover:bg-red-500 hover:text-white transition-all">刪除此筆</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
