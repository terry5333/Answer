"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy, addDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.role !== "teacher") {
          alert("權限不足");
          return router.push("/dashboard");
        }
        setTeacherData(data);
      }
      fetchAdminData();
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

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleAddSubject = async () => {
    if (!newSubject) return;
    await addDoc(collection(db, "subjects"), { name: newSubject });
    setNewSubject("");
    fetchAdminData();
  };

  const handleDeleteSubject = async (id: string) => {
    if(confirm("確定刪除此科目？")) {
      await deleteDoc(doc(db, "subjects", id));
      fetchAdminData();
    }
  };

  // 🔥 核心修改：前端直傳 Google Drive 邏輯
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;

    if (!file || !subject || !title) {
      alert("請填寫完整資訊！");
      setIsUploading(false);
      return;
    }

    try {
      // 1. 取得 Access Token (從我們的輕量 API)
      const tokenRes = await fetch('/api/auth/google-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error("取得 Google 授權失敗");

      // 2. 準備 Google Drive Multipart 上傳內容
      const metadata = {
        name: file.name,
        parents: [process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID],
      };

      const uploadFormData = new FormData();
      uploadFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      uploadFormData.append('file', file);

      // 3. 直接對 Google API 發送請求 (不受 Vercel 4.5MB 限制)
      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        body: uploadFormData,
      });

      const driveData = await driveRes.json();
      if (!driveRes.ok) throw new Error(driveData.error?.message || 'Drive 上傳失敗');

      // 4. 上傳成功後，將檔案 ID 寫回 Firestore
      await addDoc(collection(db, "solutions"), {
        subject,
        title,
        drive_file_id: driveData.id,
        view_count: 0,
        created_at: serverTimestamp()
      });

      alert("✅ 檔案直傳 Google Drive 成功！");
      fetchAdminData();
      (e.target as HTMLFormElement).reset();

    } catch (error: any) {
      console.error("上傳過程錯誤:", error);
      alert(`❌ 錯誤: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSolution = async (id: string) => {
    if(confirm("確定從系統移除此解答嗎？")) {
      await deleteDoc(doc(db, "solutions", id));
      fetchAdminData();
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.seat || !newStudent.name) return;
    await setDoc(doc(db, "students", newStudent.seat), { 
      seat_number: Number(newStudent.seat), 
      name: newStudent.name 
    });
    setNewStudent({ seat: "", name: "" });
    fetchAdminData();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8 pb-20 relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* 頂部標題與登出 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 shadow-lg flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-900">👨‍🏫 老師管理中控台</h1>
          <div className="flex items-center gap-6">
            <span className="text-indigo-700 font-bold text-lg">{teacherData?.name || teacherData?.email?.split('@')[0]} 老師，您好</span>
            <button onClick={handleLogout} className="bg-red-400 hover:bg-red-500 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md transition-all transform hover:-translate-y-0.5">
              登出
            </button>
          </div>
        </div>

        {/* 懸浮導覽列 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-full p-3 px-6 shadow-lg flex justify-center gap-4 sticky top-4 z-40">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📘 科目與解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>👥 學生管理</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📊 報表分析</button>
        </div>

        {/* 區塊 1: 科目與解答管理 */}
        {activeTab === "solutions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🏷️ 科目設定</h2>
              <div className="flex gap-2 mb-6">
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目 (例: 歷史)" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 focus:outline-none" />
                <button onClick={handleAddSubject} className="bg-indigo-600 text-white px-4 py-2 rounded-[2rem] font-bold">+</button>
              </div>
              <div className="space-y-2">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex justify-between items-center bg-white/50 rounded-[1.5rem] px-4 py-2">
                    <span className="font-bold text-gray-700">{sub.name}</span>
                    <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-8">
              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-6">📤 上傳新解答</h2>
                <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-center">
                  <select name="subject" required className="bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 focus:outline-none w-full md:w-auto">
                    <option value="">選擇科目</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                  </select>
                  <input name="title" required placeholder="標題 (例: 1-1 習作)" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 focus:outline-none w-full" />
                  <input type="file" name="file" required className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 text-gray-600 w-full md:w-auto" />
                  <button disabled={isUploading || subjects.length === 0} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-[3rem] shadow-lg disabled:opacity-50">
                    {isUploading ? "上傳中..." : "上傳"}
                  </button>
                </form>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📚 已上傳解答管理</h2>
                <div className="space-y-3">
                  {solutions.map((sol) => (
                    <div key={sol.id} className="flex justify-between items-center bg-white/50 rounded-[2rem] px-6 py-4">
                      <span className="font-bold text-gray-700"><span className="text-indigo-500 mr-2">[{sol.subject}]</span> {sol.title}</span>
                      <button onClick={() => handleDeleteSolution(sol.id)} className="bg-red-100 text-red-600 font-bold px-4 py-1 rounded-full hover:bg-red-200 transition">刪除</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 區塊 2: 學生管理 */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-6">📝 資料管理跟填寫</h2>
              <p className="text-sm text-gray-500 mb-4">設定座號與姓名，學生登入時才能正確綁定。</p>
              <div className="flex gap-2 mb-6">
                <input type="number" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} placeholder="座號" className="w-24 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 focus:outline-none" />
                <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="學生姓名" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 focus:outline-none" />
                <button onClick={handleAddStudent} className="bg-teal-600 text-white px-6 py-2 rounded-[2rem] font-bold">新增</button>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🧑‍🎓 學生名單 (點擊查看紀錄)</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map(student => (
                  <button key={student.id} onClick={() => setSelectedStudent(student)} className="bg-white/50 hover:bg-white/80 border border-gray-200 rounded-[2rem] p-4 text-center transition-all shadow-sm transform hover:-translate-y-1">
                    <div className="text-teal-600 font-bold text-lg">{student.seat_number} 號</div>
                    <div className="text-gray-700 font-medium">{student.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 區塊 3: 報表分析 */}
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">📊 科目點擊率分佈</h2>
              {subjectChartData.length > 0 ? (
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {subjectChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', background: 'rgba(255,255,255,0.9)' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">尚無足夠數據</div>
              )}
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🔥 單題解答點擊排行榜</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {[...solutions].sort((a,b) => (b.view_count || 0) - (a.view_count || 0)).map((sol, index) => (
                  <div key={sol.id} className="flex justify-between items-center bg-white/50 rounded-[2rem] px-6 py-4">
                    <span className="font-bold text-gray-700"><span className="text-orange-500 mr-2">#{index + 1}</span> [{sol.subject}] {sol.title}</span>
                    <span className="bg-orange-100 text-orange-600 font-bold px-4 py-1 rounded-full">{sol.view_count || 0} 次</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 學生個人紀錄 Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-2xl p-8 w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {selectedStudent.seat_number}號 {selectedStudent.name} - 觀看紀錄
              </h3>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-500 hover:text-red-500 font-bold text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {getStudentLogs(selectedStudent.seat_number).length > 0 ? (
                getStudentLogs(selectedStudent.seat_number).map(log => {
                  const sol = solutions.find(s => s.id === log.solution_id);
                  return (
                    <div key={log.id} className="bg-white/60 rounded-[1.5rem] px-6 py-4 flex justify-between items-center">
                      <span className="font-medium text-gray-700">{sol ? `[${sol.subject}] ${sol.title}` : log.solution_id}</span>
                      <span className="text-sm text-gray-500">{log.viewed_at ? new Date(log.viewed_at.toDate()).toLocaleString() : "剛剛"}</span>
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-gray-400 py-10">尚無觀看紀錄</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
