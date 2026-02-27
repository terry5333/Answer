"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, query, orderBy, 
  addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, writeBatch 
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
  const [teacherData, setTeacherData] = useState<any>(null);
  
  const [newSubject, setNewSubject] = useState("");
  const [newStudent, setNewStudent] = useState({ seat: "", name: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  
  // 排序狀態
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
          alert("權限不足，僅限老師進入");
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
    } catch (error) {
      console.error("資料獲取錯誤:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleAddSubject = async () => {
    if (!newSubject) return;
    try {
      await addDoc(collection(db, "subjects"), { name: newSubject });
      setNewSubject("");
      fetchAdminData();
    } catch (error) {
      alert("新增科目失敗");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if(confirm("確定刪除此科目？")) {
      try {
        await deleteDoc(doc(db, "subjects", id));
        fetchAdminData();
      } catch (error) {
        alert("刪除失敗");
      }
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;
    const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

    if (!file || !subject || !title || !folderId) {
      alert("請填寫完整資訊並確認環境變數已設定！");
      setIsUploading(false);
      return;
    }

    try {
      const tokenRes = await fetch('/api/auth/google-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error("取得授權失敗，請檢查金鑰狀態");

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

      alert("✅ 上傳成功！檔案已存入指定資料夾。");
      fetchAdminData();
      (e.target as HTMLFormElement).reset();

    } catch (error: any) {
      alert(`❌ 失敗: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSolution = async (id: string) => {
    if(confirm("確定刪除解答記錄？")) {
      await deleteDoc(doc(db, "solutions", id));
      fetchAdminData();
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.seat || !newStudent.name) return;
    await setDoc(doc(db, "students", newStudent.seat), { 
      seat_number: Number(newStudent.seat), 
      name: newStudent.name,
      bound_uid: null
    });
    setNewStudent({ seat: "", name: "" });
    fetchAdminData();
  };

  // 🚀 解除綁定學生帳號
  const handleUnbindStudent = async (seatId: string, boundUid: string) => {
    if (!confirm(`確定要解除 ${seatId} 號的 Google 帳號綁定嗎？`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "students", seatId), { bound_uid: null, bound_email: null, photo_url: null });
      batch.delete(doc(db, "users", boundUid));
      await batch.commit();
      alert("✅ 解除綁定成功！");
      fetchAdminData();
    } catch (error) {
      console.error("解綁失敗:", error);
      alert("解除綁定失敗，請檢查權限。");
    }
  };

  // 🚀 手動輸入 UID 綁定舊學生
  const handleManualBind = async (seatId: string) => {
    const manualUid = prompt(`請輸入 ${seatId} 號學生的 Google UID：`);
    if (!manualUid || manualUid.trim() === "") return;

    try {
      await updateDoc(doc(db, "students", seatId), { 
        bound_uid: manualUid.trim()
      });
      await setDoc(doc(db, "users", manualUid.trim()), {
        role: "student",
        seat_number: Number(seatId)
      }, { merge: true });

      alert(`✅ 已成功將 ${seatId} 號綁定至該 UID！`);
      fetchAdminData();
    } catch (error) {
      console.error("手動綁定失敗:", error);
      alert("手動綁定失敗，請確認 UID 格式是否正確。");
    }
  };

  const getStudentLogs = (seat_number: number) => {
    return viewLogs.filter(log => log.seat_number === seat_number);
  };

  const subjectChartData = subjects.map(sub => {
    const totalViews = solutions
      .filter(sol => sol.subject === sub.name)
      .reduce((sum, sol) => sum + (sol.view_count || 0), 0);
    return { name: sub.name, value: totalViews };
  }).filter(data => data.value > 0);

  // 🚀 前端動態排序
  const sortedSolutions = [...solutions].sort((a, b) => {
    if (sortMethod === "subject") return a.subject.localeCompare(b.subject, 'zh-TW');
    return 0;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-bold">確認權限中...</div>;

  // 安全驗證閘門
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-12 shadow-2xl w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">安全驗證</h1>
          <p className="text-gray-500 mb-8">進入 TerryEdu 管理系統前請先完成驗證。</p>
          <div className="flex justify-center mb-6">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
          <p className="text-xs text-gray-400">當前身分：{teacherData?.name} 老師</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8 pb-20 relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* 頂部標題與老師頭像 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 shadow-lg flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-2xl md:text-3xl font-bold text-indigo-900 font-sans">👨‍🏫 老師管理中控台</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/50 pl-2 pr-5 py-1.5 rounded-full border border-indigo-100 hidden md:flex shadow-sm">
              <img 
                src={auth.currentUser?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Teacher"} 
                alt="Teacher" 
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className="text-indigo-800 font-bold text-sm">老師，您好</span>
            </div>
            <button onClick={handleLogout} className="bg-red-400 hover:bg-red-500 text-white px-5 py-2.5 rounded-[2rem] font-bold shadow-md transition-all active:scale-95">登出</button>
          </div>
        </div>

        {/* 導覽列 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-full p-3 px-6 shadow-lg flex justify-center gap-4 sticky top-4 z-40">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📘 科目與解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>👥 學生管理</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📊 報表分析</button>
        </div>

        {/* 📘 科目與解答頁籤 */}
        {activeTab === "solutions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🏷️ 科目設定</h2>
              <div className="flex gap-2 mb-6">
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                <button onClick={handleAddSubject} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-[2rem] font-bold shadow-md transition-all active:scale-95">+</button>
              </div>
              <div className="space-y-2">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex justify-between items-center bg-white/50 rounded-[1.5rem] px-4 py-2 text-gray-700 font-bold hover:bg-white/80 transition-colors">
                    {sub.name}
                    <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-8">
              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-6">📤 上傳新解答</h2>
                <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-center">
                  <select name="subject" required className="bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-300 transition-all cursor-pointer">
                    <option value="">選擇科目</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                  </select>
                  <input name="title" required placeholder="標題" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                  <input type="file" name="file" required className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                  <button disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-[3rem] disabled:opacity-50 shadow-md transition-all active:scale-95">
                    {isUploading ? "上傳中..." : "上傳"}
                  </button>
                </form>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">📚 已上傳解答</h2>
                  <select 
                    value={sortMethod} 
                    onChange={(e) => setSortMethod(e.target.value)} 
                    className="bg-white/60 border border-white/50 text-gray-700 rounded-[2rem] px-4 py-2 shadow-sm outline-none text-sm font-bold cursor-pointer hover:bg-white/80 transition-all focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="time">🕒 最新上傳</option>
                    <option value="subject">🏷️ 依科目排序</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {sortedSolutions.map((sol) => (
                    <div key={sol.id} className="flex justify-between items-center bg-white/50 rounded-[2rem] px-6 py-4 hover:bg-white/80 transition-all shadow-sm">
                      <span className="font-bold text-gray-700"><span className="text-indigo-500 mr-2 tracking-widest">[{sol.subject}]</span> {sol.title}</span>
                      <button onClick={() => handleDeleteSolution(sol.id)} className="bg-red-50 text-red-500 font-bold px-4 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm">刪除</button>
                    </div>
                  ))}
                  {sortedSolutions.length === 0 && <div className="text-center py-10 text-gray-400 font-medium">目前還沒有上傳任何解答</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 學生管理頁籤 */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-6">📝 學生名單管理</h2>
              <div className="flex gap-2 mb-6">
                <input type="number" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} placeholder="座號" className="w-24 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 outline-none focus:ring-2 focus:ring-teal-300 transition-all" />
                <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="姓名" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 outline-none focus:ring-2 focus:ring-teal-300 transition-all" />
                <button onClick={handleAddStudent} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-[2rem] font-bold shadow-md transition-all active:scale-95">新增</button>
              </div>
            </div>
            
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
               <h2 className="text-xl font-bold text-gray-800 mb-6">🧑‍🎓 學生名單與綁定狀態</h2>
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                 {students.map(student => (
                   <div key={student.id} className="bg-white/50 rounded-[2rem] p-5 flex flex-col justify-between shadow-sm border border-transparent hover:border-white/80 hover:shadow-md transition-all">
                     
                     {/* 學生頭像與基本資訊 */}
                     <div onClick={() => setSelectedStudent(student)} className="cursor-pointer flex flex-col items-center mb-4 group">
                       <div className="relative mb-2">
                         <img 
                           src={student.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} 
                           alt={student.name} 
                           className="w-14 h-14 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform"
                           referrerPolicy="no-referrer"
                         />
                         <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white text-[10px] font-extrabold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                           {student.seat_number}
                         </div>
                       </div>
                       <div className="text-gray-700 font-bold mt-1 group-hover:text-teal-600 transition-colors">{student.name}</div>
                     </div>
                     
                     {/* 綁定狀態區塊 */}
                     {student.bound_uid ? (
                       <div className="flex flex-col items-center gap-2 border-t border-gray-200/60 pt-3">
                         <span className="text-[10px] text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full w-full text-center">已綁定 Google</span>
                         <button 
                           onClick={() => handleUnbindStudent(student.id, student.bound_uid)} 
                           className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white font-bold transition-all w-full shadow-sm active:scale-95"
                         >
                           解除綁定
                         </button>
                       </div>
                     ) : (
                       <div className="flex flex-col items-center gap-2 border-t border-gray-200/60 pt-3">
                         <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full w-full text-center">尚未綁定</span>
                         <button 
                           onClick={() => handleManualBind(student.id)} 
                           className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded-full hover:bg-indigo-600 hover:text-white font-bold transition-all w-full shadow-sm active:scale-95"
                         >
                           輸入 UID 綁定
                         </button>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* 📊 報表分析頁籤 */}
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-96 flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">📊 科目點擊分佈</h2>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                    {subjectChartData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🔥 熱門解答</h2>
              {solutions.sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, idx) => (
                <div key={sol.id} className="flex justify-between items-center p-4 bg-white/50 rounded-[1.5rem] mb-3 font-bold text-gray-700 shadow-sm hover:bg-white/80 transition-all">
                  <span className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-300' : idx === 2 ? 'bg-orange-300' : 'bg-indigo-200'}`}>
                      {idx + 1}
                    </span>
                    {sol.title}
                  </span>
                  <span className="text-orange-500 bg-orange-50 px-3 py-1 rounded-full">{sol.view_count || 0} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 觀看紀錄 Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[3rem] p-8 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <img 
                  src={selectedStudent.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.name}`} 
                  alt={selectedStudent.name} 
                  className="w-12 h-12 rounded-full shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-2xl font-bold text-gray-800">{selectedStudent.seat_number}號 {selectedStudent.name} 紀錄</h3>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-500 hover:text-white transition-all font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              {getStudentLogs(selectedStudent.seat_number).map(log => {
                const sol = solutions.find(s => s.id === log.solution_id);
                return (
                  <div key={log.id} className="bg-white/60 border border-gray-100 rounded-[1.5rem] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-white/90 transition-all shadow-sm">
                    <span className="font-bold text-gray-700">
                      {sol ? <><span className="text-indigo-500 mr-2 tracking-widest">[{sol.subject}]</span>{sol.title}</> : <span className="text-gray-400 italic">已刪除解答</span>}
                    </span>
                    <span className="text-xs text-gray-400 font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      {log.viewed_at ? new Date(log.viewed_at.toDate()).toLocaleString() : "剛才"}
                    </span>
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
