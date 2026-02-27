"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
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
  const [teacherData, setTeacherData] = useState<any>(null);
  
  const [newSubject, setNewSubject] = useState("");
  const [newStudent, setNewStudent] = useState({ seat: "", name: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [sortMethod, setSortMethod] = useState("time");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.role !== "teacher") {
          alert("權限不足");
          return router.push("/dashboard");
        }
        setTeacherData(data);
      }
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
    } catch (error) { console.error("資料獲取錯誤:", error); }
  };

  const handleLogout = async () => { await signOut(auth); router.push("/login"); };

  const handleAddSubject = async () => {
    if (!newSubject) return;
    try { await addDoc(collection(db, "subjects"), { name: newSubject }); setNewSubject(""); fetchAdminData(); } 
    catch (error) { alert("新增失敗"); }
  };

  const handleDeleteSubject = async (id: string) => {
    if(confirm("確定刪除此科目？")) { await deleteDoc(doc(db, "subjects", id)); fetchAdminData(); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

    if (!file || !subject || !title || !folderId) { alert("請填寫完整資訊"); setIsUploading(false); return; }

    try {
      const tokenRes = await fetch('/api/auth/google-token');
      const tokenData = await tokenRes.json();
      const metadata = { name: file.name, parents: [folderId] };
      const uploadFormData = new FormData();
      uploadFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      uploadFormData.append('file', file);

      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}` }, body: uploadFormData,
      });
      const driveData = await driveRes.json();
      
      await addDoc(collection(db, "solutions"), { subject, title, drive_file_id: driveData.id, view_count: 0, created_at: serverTimestamp() });
      alert("✅ 上傳成功！"); fetchAdminData(); (e.target as HTMLFormElement).reset();
    } catch (error: any) { alert(`❌ 失敗: ${error.message}`); } finally { setIsUploading(false); }
  };

  const handleDeleteSolution = async (id: string) => {
    if(confirm("確定刪除？")) { await deleteDoc(doc(db, "solutions", id)); fetchAdminData(); }
  };

  const handleAddStudent = async () => {
    if (!newStudent.seat || !newStudent.name) return;
    await setDoc(doc(db, "students", newStudent.seat), { seat_number: Number(newStudent.seat), name: newStudent.name, bound_uid: null });
    setNewStudent({ seat: "", name: "" }); fetchAdminData();
  };

  const handleUnbindStudent = async (seatId: string, boundUid: string) => {
    if (!confirm(`確定解除 ${seatId} 號綁定？`)) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
    batch.delete(doc(db, "users", boundUid));
    await batch.commit(); fetchAdminData();
  };

  const handleManualBind = async (seatId: string) => {
    const manualUid = prompt(`請輸入 ${seatId} 號學生的 UID：`);
    if (!manualUid || !manualUid.trim()) return;
    await updateDoc(doc(db, "students", seatId), { bound_uid: manualUid.trim() });
    await setDoc(doc(db, "users", manualUid.trim()), { role: "student", seat_number: Number(seatId) }, { merge: true });
    fetchAdminData();
  };

  const getStudentLogs = (seat_number: number) => viewLogs.filter(log => log.seat_number === seat_number);

  const sortedSolutions = [...solutions].sort((a, b) => {
    if (sortMethod === "subject") return a.subject.localeCompare(b.subject, 'zh-TW');
    return 0;
  });

  const subjectChartData = subjects.map(sub => {
    const value = solutions.filter(sol => sol.subject === sub.name).reduce((sum, sol) => sum + (sol.view_count || 0), 0);
    return { name: sub.name, value };
  }).filter(data => data.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-5">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-indigo-600 font-bold text-lg tracking-widest animate-pulse">讀取資料中...</div>
        </div>
      </div>
    );
  }

  if (!isVerified) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl text-center">
        <h1 className="text-xl font-bold mb-4 text-gray-800">管理員驗證</h1>
        <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4 md:p-8 pb-24 relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-8">
        
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-5 md:p-6 px-5 md:px-10 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-xl md:text-3xl font-bold text-indigo-900">老師中控台</h1>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
            <div className="flex items-center gap-2 bg-white/50 pl-1 pr-4 md:pr-5 py-1 md:py-1.5 rounded-full border border-indigo-100 shadow-sm">
              <img src={auth.currentUser?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Teacher"} className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white" referrerPolicy="no-referrer" />
              <span className="text-indigo-800 font-bold text-xs md:text-sm whitespace-nowrap">老師，您好</span>
            </div>
            <button onClick={handleLogout} className="bg-red-400 text-white px-4 md:px-5 py-2 rounded-full font-bold text-sm shadow-sm whitespace-nowrap active:scale-95 transition-all">登出</button>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-full p-2 md:p-3 shadow-lg flex flex-wrap justify-center gap-2 md:gap-4 sticky top-2 z-40">
          <button onClick={() => setActiveTab("solutions")} className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-sm md:text-base w-[48%] md:w-auto transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-white/50"}`}>📘 解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-sm md:text-base w-[48%] md:w-auto transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-sm" : "text-gray-600 hover:bg-white/50"}`}>👥 學生</button>
          <button onClick={() => setActiveTab("reports")} className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-sm md:text-base w-full sm:w-auto transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-sm" : "text-gray-600 hover:bg-white/50"}`}>📊 報表</button>
        </div>

        {activeTab === "solutions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg h-fit">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">🏷️ 科目設定</h2>
              <div className="flex gap-2 mb-4 md:mb-6">
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目" className="flex-1 bg-white/50 border border-gray-300 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={handleAddSubject} className="bg-indigo-600 text-white px-4 py-2 rounded-full font-bold active:scale-95">+</button>
              </div>
              <div className="space-y-2">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex justify-between items-center bg-white/50 rounded-full px-4 py-2 text-sm font-bold">{sub.name}<button onClick={() => handleDeleteSubject(sub.id)} className="text-red-400">✕</button></div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">📤 上傳解答</h2>
                <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch sm:items-center">
                  <select name="subject" required className="bg-white/50 border border-gray-300 rounded-full px-4 py-3 outline-none text-sm w-full sm:w-1/3">
                    <option value="">選擇科目</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                  </select>
                  <input name="title" required placeholder="標題" className="bg-white/50 border border-gray-300 rounded-full px-4 py-3 outline-none text-sm w-full sm:flex-1" />
                  <input type="file" name="file" required className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 w-full sm:w-auto" />
                  <button disabled={isUploading} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-full disabled:opacity-50 text-sm w-full sm:w-auto active:scale-95">
                    {isUploading ? "上傳中..." : "上傳"}
                  </button>
                </form>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-3">
                  <h2 className="text-lg md:text-xl font-bold text-gray-800">📚 已上傳解答</h2>
                  <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="bg-white/60 border border-white/50 rounded-full px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-auto">
                    <option value="time">🕒 最新上傳</option>
                    <option value="subject">🏷️ 依科目排序</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {sortedSolutions.map((sol) => (
                    <div key={sol.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/50 rounded-2xl md:rounded-full px-5 py-4 gap-3 shadow-sm hover:bg-white/80 transition-all">
                      <span className="font-bold text-gray-700 text-sm md:text-base leading-snug"><span className="text-indigo-500 mr-2 tracking-wider">[{sol.subject}]</span>{sol.title}</span>
                      <button onClick={() => handleDeleteSolution(sol.id)} className="bg-red-50 text-red-500 text-xs font-bold px-4 py-2 rounded-full self-end sm:self-auto hover:bg-red-500 hover:text-white transition-all">刪除</button>
                    </div>
                  ))}
                  {sortedSolutions.length === 0 && <div className="text-center py-6 text-gray-400">尚無解答</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">📝 新增學生</h2>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-2">
                <input type="number" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} placeholder="座號" className="w-full sm:w-24 bg-white/50 border border-gray-300 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-teal-300" />
                <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="姓名" className="flex-1 bg-white/50 border border-gray-300 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-teal-300" />
                <button onClick={handleAddStudent} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-full font-bold w-full sm:w-auto active:scale-95 transition-all">新增</button>
              </div>
            </div>
            
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg">
               <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">🧑‍🎓 學生名單與狀態</h2>
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                 {students.map(student => (
                   <div key={student.id} className="bg-white/50 rounded-[1.5rem] md:rounded-3xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                     <div onClick={() => setSelectedStudent(student)} className="cursor-pointer flex flex-col items-center mb-4 group">
                       <div className="relative mb-2">
                         <img src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} alt={student.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                         <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full border border-white shadow-sm">{student.seat_number}</div>
                       </div>
                       <div className="text-gray-700 font-bold mt-1 text-sm md:text-base group-hover:text-teal-600 transition-colors">{student.name}</div>
                     </div>
                     {student.bound_uid ? (
                       <div className="flex flex-col gap-2 border-t border-gray-200/60 pt-3">
                         <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-1 rounded-full text-center">已綁定</span>
                         <button onClick={() => handleUnbindStudent(student.id, student.bound_uid)} className="text-[11px] bg-red-50 text-red-500 py-1.5 rounded-full font-bold hover:bg-red-500 hover:text-white transition-all">解除綁定</button>
                       </div>
                     ) : (
                       <div className="flex flex-col gap-2 border-t border-gray-200/60 pt-3">
                         <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded-full text-center">未綁定</span>
                         <button onClick={() => handleManualBind(student.id)} className="text-[11px] bg-indigo-50 text-indigo-600 py-1.5 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all">輸入 UID</button>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-lg h-72 md:h-96">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-2">📊 科目點擊分佈</h2>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">{subjectChartData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            </div>
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 md:p-8 shadow-lg overflow-y-auto max-h-96">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🔥 熱門解答</h2>
              {solutions.sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, idx) => (
                <div key={sol.id} className="flex justify-between items-center p-4 bg-white/50 rounded-[1.5rem] mb-3 font-bold text-gray-700 shadow-sm hover:bg-white/80 transition-all">
                  <span className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-white text-sm ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-300' : idx === 2 ? 'bg-orange-300' : 'bg-indigo-200'}`}>
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{sol.title}</span>
                  </span>
                  <span className="text-orange-500 bg-orange-50 px-3 py-1 rounded-full text-sm whitespace-nowrap">{sol.view_count || 0} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 md:p-4 animate-in fade-in">
          <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-[2rem] md:rounded-[3rem] p-5 md:p-8 w-full h-full md:max-w-2xl md:h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 md:mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3 md:gap-4">
                <img src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                <h3 className="text-lg md:text-2xl font-bold text-gray-800">{selectedStudent.seat_number}號 {selectedStudent.name}</h3>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 bg-gray-100 hover:bg-red-500 hover:text-white rounded-full font-bold transition-all">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {getStudentLogs(selectedStudent.seat_number).map(log => {
                const sol = solutions.find(s => s.id === log.solution_id);
                return (
                  <div key={log.id} className="bg-white/60 border border-gray-100 rounded-2xl px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm">
                    <span className="font-bold text-gray-700 text-sm md:text-base">{sol ? <><span className="text-indigo-500 mr-2">[{sol.subject}]</span>{sol.title}</> : <span className="text-gray-400 italic">已刪除解答</span>}</span>
                    <span className="text-[10px] md:text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full self-start sm:self-auto border border-gray-100">{log.viewed_at ? new Date(log.viewed_at.toDate()).toLocaleString() : "剛才"}</span>
                  </div>
                );
              })}
              {getStudentLogs(selectedStudent.seat_number).length === 0 && <div className="text-center py-10 text-gray-400 font-medium">尚無觀看紀錄</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
