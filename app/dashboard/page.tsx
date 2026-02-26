"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
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
      const userSnap = await getDoc(doc(db, "users", user.uid));
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
      
      fetchSolutions();
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-8 relative">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        
        {/* 頂部導覽 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800">📖 學生解答區</h1>
          <div className="flex items-center gap-6">
            <div className="text-indigo-700 font-bold text-lg">
              {userData ? `${userData.seat_number} 號 - ${userData.name || "同學"}` : "載入中..."}
            </div>
            <button onClick={handleLogout} className="bg-red-400 hover:bg-red-500 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md transition-all transform hover:-translate-y-0.5">
              登出
            </button>
          </div>
        </div>

        {/* 科目選擇與解答列表 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-10 shadow-lg min-h-[60vh]">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-gray-700">選擇科目</h2>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="bg-white/50 border border-gray-300 text-gray-700 rounded-[2rem] px-6 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer">
              <option value="全部">全部</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSolutions.map((sol) => (
              <div key={sol.id} onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} className="bg-white/50 hover:bg-white/70 backdrop-blur-md border border-white/50 rounded-[3rem] p-6 cursor-pointer transition-all transform hover:-translate-y-1 shadow-md group relative">
                <div className="absolute top-4 right-4 bg-white/60 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-orange-500 shadow-sm flex items-center gap-1">
                  🔥 {sol.view_count || 0}
                </div>
                <div className="text-sm text-indigo-500 font-bold mb-2 mt-4">{sol.subject}</div>
                <h3 className="text-lg font-bold text-gray-800">{sol.title}</h3>
                <p className="text-gray-500 text-sm mt-4 group-hover:text-indigo-600 transition-colors">點擊查看解答 ➔</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 預覽解答 Modal */}
      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-10">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="flex justify-between items-center p-6 border-b border-gray-200/50 bg-white/50">
              <h3 className="text-xl font-bold text-gray-800">解答預覽</h3>
              <button onClick={() => setViewingPreviewUrl(null)} className="bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 h-10 w-10 rounded-full flex items-center justify-center transition-colors font-bold">✕</button>
            </div>
            <div className="flex-1 w-full h-full bg-gray-100/50">
              <iframe src={viewingPreviewUrl} className="w-full h-full border-0 rounded-b-[3rem]" allow="autoplay" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
