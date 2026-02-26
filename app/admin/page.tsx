"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, query, orderBy, 
  addDoc, deleteDoc, setDoc, serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Turnstile from "react-turnstile";

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

  // 🛡️ 驗證閘門狀態：每次重新進入系統都要點 Turnstile
  const [isVerified, setIsVerified] = useState(false);

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

  // ✅ 修正：補回缺失的 handleAddSubject 函數
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

  // ✅ 修正：補回缺失的 handleDeleteSubject 函數
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

  // 🔥 核心功能：前端直傳 Google Drive 並歸檔
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

      const metadata = {
        name: file.name,
        parents: [folderId], 
      };

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-bold">確認權限中...</div>;

  // 🛡️ 驗證閘門 UI
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-12 shadow-2xl w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">安全驗證</h1>
          <p className="text-gray-500 mb-8">進入 TerryEdu 管理系統前請先完成驗證。</p>
          <div className="flex justify-center mb-6">
            <Turnstile
              sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onVerify={() => setIsVerified(true)}
            />
          </div>
          <p className="text-xs text-gray-400">當前身分：{teacherData?.name} 老師</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8 pb-20 relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* 頂部標題 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 shadow-lg flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-900 font-sans">👨‍🏫 老師管理中控台</h1>
          <button onClick={handleLogout} className="bg-red-400 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md">登出</button>
        </div>

        {/* 導覽列 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-full p-3 px-6 shadow-lg flex justify-center gap-4 sticky top-4 z-40">
          <button onClick={() => setActiveTab("solutions")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "solutions" ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📘 科目與解答</button>
          <button onClick={() => setActiveTab("students")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "students" ? "bg-teal-600 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>👥 學生管理</button>
          <button onClick={() => setActiveTab("reports")} className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === "reports" ? "bg-orange-500 text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}>📊 報表分析</button>
        </div>

        {activeTab === "solutions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 科目管理 */}
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🏷️ 科目設定</h2>
              <div className="flex gap-2 mb-6">
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="新增科目" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2 focus:outline-none" />
                <button onClick={handleAddSubject} className="bg-indigo-600 text-white px-4 py-2 rounded-[2rem] font-bold">+</button>
              </div>
              <div className="space-y-2">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex justify-between items-center bg-white/50 rounded-[1.5rem] px-4 py-2 text-gray-700 font-bold">
                    {sub.name}
                    <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 上傳解答 */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-6">📤 上傳新解答</h2>
                <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-center">
                  <select name="subject" required className="bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3">
                    <option value="">選擇科目</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                  </select>
                  <input name="title" required placeholder="標題" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3" />
                  <input type="file" name="file" required className="text-sm text-gray-600" />
                  <button disabled={isUploading} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-[3rem] disabled:opacity-50">
                    {isUploading ? "上傳中..." : "上傳"}
                  </button>
                </form>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📚 已上傳解答</h2>
                <div className="space-y-3">
                  {solutions.map((sol) => (
                    <div key={sol.id} className="flex justify-between items-center bg-white/50 rounded-[2rem] px-6 py-4">
                      <span className="font-bold text-gray-700">[{sol.subject}] {sol.title}</span>
                      <button onClick={() => handleDeleteSolution(sol.id)} className="text-red-600 font-bold">刪除</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 學生管理與報表區塊保持功能邏輯不變 */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-6">📝 學生名單管理</h2>
              <div className="flex gap-2 mb-6">
                <input type="number" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} placeholder="座號" className="w-24 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2" />
                <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="姓名" className="flex-1 bg-white/50 border border-gray-300 rounded-[2rem] px-4 py-2" />
                <button onClick={handleAddStudent} className="bg-teal-600 text-white px-6 py-2 rounded-[2rem] font-bold">新增</button>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
               <h2 className="text-xl font-bold text-gray-800 mb-6">🧑‍🎓 學生名單</h2>
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                 {students.map(student => (
                   <button key={student.id} onClick={() => setSelectedStudent(student)} className="bg-white/50 rounded-[2rem] p-4 text-center shadow-sm hover:-translate-y-1 transition-all">
                     <div className="text-teal-600 font-bold">{student.seat_number} 號</div>
                     <div className="text-gray-700 font-medium">{student.name}</div>
                   </button>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-96 flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">📊 科目點擊分佈</h2>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">
                    {subjectChartData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🔥 熱門解答</h2>
              {solutions.sort((a,b) => (b.view_count||0)-(a.view_count||0)).map((sol, idx) => (
                <div key={sol.id} className="flex justify-between p-4 bg-white/50 rounded-[1.5rem] mb-2 font-bold text-gray-700">
                  <span>#{idx+1} {sol.title}</span>
                  <span className="text-orange-500">{sol.view_count || 0} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 觀看紀錄 Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] p-8 w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">{selectedStudent.seat_number}號 {selectedStudent.name} 紀錄</h3>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-500 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-2">
              {getStudentLogs(selectedStudent.seat_number).map(log => {
                const sol = solutions.find(s => s.id === log.solution_id);
                return (
                  <div key={log.id} className="bg-white/60 rounded-[1.5rem] px-6 py-4 flex justify-between items-center">
                    <span className="font-medium text-gray-700">{sol ? `[${sol.subject}] ${sol.title}` : "已刪除解答"}</span>
                    <span className="text-sm text-gray-400">{log.viewed_at ? new Date(log.viewed_at.toDate()).toLocaleString() : "剛才"}</span>
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
