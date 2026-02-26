"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, writeBatch, 
  increment, serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }
      fetchSolutions();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSolutions = async () => {
    const querySnapshot = await getDocs(collection(db, "solutions"));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSolutions(data);
  };

  const handleViewSolution = async (solutionId: string, driveFileId: string) => {
    if (!userData) return;

    try {
      const batch = writeBatch(db);
      // 雖然學生看不到，但我們依然在後台統計點擊數給老師看
      const solutionRef = doc(db, "solutions", solutionId);
      batch.update(solutionRef, { view_count: increment(1) });

      const logRef = doc(collection(db, "view_logs"));
      batch.set(logRef, {
        student_uid: userData.uid,
        seat_number: userData.seat_number,
        solution_id: solutionId,
        viewed_at: serverTimestamp()
      });

      await batch.commit();

      const previewUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
      setViewingPreviewUrl(previewUrl);
      
      // 更新本地狀態（不重新 fetch 也可以，因為學生端已不顯示點擊數）
    } catch (error) {
      console.error("紀錄失敗:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const filteredSolutions = selectedSubject === "全部" 
    ? solutions 
    : solutions.filter(s => s.subject === selectedSubject);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-8 relative font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        
        {/* 頂部導覽列 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">📖 學生解答大廳</h1>
          <div className="flex items-center gap-6">
            <div className="text-indigo-700 font-bold text-lg bg-indigo-50/50 px-4 py-1 rounded-full border border-indigo-100">
              {userData ? `${userData.seat_number} 號 - ${userData.name || "同學"}` : "載入中..."}
            </div>
            <button onClick={handleLogout} className="bg-red-400 hover:bg-red-500 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md transition-all active:scale-95">
              登出
            </button>
          </div>
        </div>

        {/* 內容篩選區 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-10 shadow-lg min-h-[60vh]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <h2 className="text-xl font-bold text-gray-700">選擇你想查看的科目</h2>
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)} 
              className="bg-white/60 border-none text-gray-700 rounded-[2rem] px-6 py-3 focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-sm outline-none"
            >
              <option value="全部">所有科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* 解答卡片列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSolutions.map((sol) => (
              <div 
                key={sol.id} 
                onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} 
                className="bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/50 rounded-[3rem] p-8 cursor-pointer transition-all transform hover:-translate-y-2 hover:shadow-2xl group relative"
              >
                {/* 註：原本這裡有個顯示點擊數的 <div>，現在已徹底移除 */}
                <div className="text-sm text-indigo-500 font-extrabold mb-3 uppercase tracking-widest">{sol.subject}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 leading-tight">{sol.title}</h3>
                <div className="flex items-center text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  開啟解答檔案 ➔
                </div>
              </div>
            ))}
          </div>

          {filteredSolutions.length === 0 && (
            <div className="text-center py-20 text-gray-400 font-medium">
              目前該科目尚無上傳的解答。
            </div>
          )}
        </div>
      </div>

      {/* 預覽解答 Modal (全螢幕磨砂質感) */}
      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-10 animate-in fade-in duration-300">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white/50">
              <h3 className="text-xl font-bold text-gray-800">📄 解答預覽中</h3>
              <button 
                onClick={() => setViewingPreviewUrl(null)} 
                className="bg-gray-100 hover:bg-red-500 hover:text-white text-gray-600 h-12 w-12 rounded-full flex items-center justify-center transition-all font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 w-full h-full bg-gray-50/50">
              <iframe 
                src={viewingPreviewUrl} 
                className="w-full h-full border-0 rounded-b-[3rem]" 
                allow="autoplay" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
