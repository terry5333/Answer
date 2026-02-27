"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, writeBatch, 
  increment, serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile"; 

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

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
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSolutions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "solutions"));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSolutions(data);
    } catch (error) {
      console.error("獲取解答失敗:", error);
    }
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
      setViewingPreviewUrl(`https://drive.google.com/file/d/${driveFileId}/preview`);
    } catch (error) {
      console.error("紀錄失敗:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // 🚀 核心優化：過濾科目，並「依照科目名稱排序」
  const sortedAndFilteredSolutions = solutions
    .filter(s => selectedSubject === "全部" || s.subject === selectedSubject)
    .sort((a, b) => a.subject.localeCompare(b.subject, 'zh-TW'));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-bold">
      確認身分中...
    </div>
  );

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 md:p-12 shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in">
          <div className="text-5xl mb-6">🛡️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">安全檢查</h1>
          <p className="text-gray-500 mb-8 text-sm md:text-base">為了保護帳號安全，請完成驗證以解鎖解答卡片。</p>
          <div className="flex justify-center mb-6 overflow-hidden">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
          <p className="text-xs text-gray-400 italic">當前身分：{userData?.seat_number} 號 {userData?.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4 md:p-8 relative">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 md:gap-8">
        
        {/* 📱 手機版自適應頂部導覽列 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2.5rem] md:rounded-[3rem] p-5 md:p-6 px-6 md:px-10 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">學生解答大廳</h1>
          </div>
          
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-4">
            <div className="flex items-center gap-2 md:gap-3 bg-white/60 px-2 py-1 pr-4 md:pr-5 rounded-full border border-indigo-100 shadow-sm flex-1 sm:flex-none justify-center">
              <img 
                src={auth.currentUser?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Student"} 
                alt="Avatar" 
                className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-sm"
                referrerPolicy="no-referrer"
              />
              <div className="text-indigo-700 font-bold text-xs md:text-sm whitespace-nowrap">
                {userData?.seat_number}號 - {userData?.name}
              </div>
            </div>
            <button onClick={handleLogout} className="bg-red-400 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-[2rem] font-bold text-sm md:text-base shadow-md transition-all hover:bg-red-500 active:scale-95 whitespace-nowrap">
              登出
            </button>
          </div>
        </div>

        {/* 📱 手機版自適應解答區 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-lg min-h-[60vh]">
          
          {/* 下拉選單區塊：手機版佔滿寬度 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-700 ml-2">選擇你想查看的科目</h2>
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)} 
              className="w-full sm:w-auto bg-white/70 border border-white text-gray-800 rounded-[2rem] px-5 py-3 shadow-sm outline-none cursor-pointer font-bold hover:bg-white/90 transition-all focus:ring-2 focus:ring-indigo-300"
            >
              <option value="全部">🔍 全部科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* 解答卡片網格：手機版 1 欄，平板 2 欄，電腦 3 欄 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
            {sortedAndFilteredSolutions.map((sol) => (
              <div 
                key={sol.id} 
                onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} 
                className="bg-white/50 hover:bg-white/80 border border-white/50 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 cursor-pointer transition-all transform hover:-translate-y-1 md:hover:-translate-y-2 group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs md:text-sm text-indigo-500 font-extrabold mb-2 md:mb-3 uppercase tracking-widest">{sol.subject}</div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 leading-snug">{sol.title}</h3>
                </div>
                <div className="text-indigo-600 font-bold text-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  開啟解答檔案 <span>➔</span>
                </div>
              </div>
            ))}
          </div>
          
          {sortedAndFilteredSolutions.length === 0 && (
            <div className="text-center py-20 text-gray-400 font-medium flex flex-col items-center gap-2">
              <span className="text-4xl">📭</span>
              <span>目前尚無此科目的解答</span>
            </div>
          )}
        </div>
      </div>

      {/* 預覽解答 Modal：手機版滿版 */}
      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-2 md:p-10 animate-in fade-in">
          <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[2rem] md:rounded-[3rem] shadow-2xl w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-4 md:p-6 bg-white/50 border-b border-gray-200/50">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 ml-2">📄 解答預覽</h3>
              <button onClick={() => setViewingPreviewUrl(null)} className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-500 hover:text-white transition-all font-bold text-lg">✕</button>
            </div>
            <iframe src={viewingPreviewUrl} className="w-full h-full border-0 md:rounded-b-[3rem] bg-gray-100" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}
