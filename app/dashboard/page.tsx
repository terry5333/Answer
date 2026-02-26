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

  // 🛡️ 學生端驗證閘門
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
      setViewingPreviewUrl(`https://drive.google.com/file/d/${driveFileId}/preview`);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-teal-600 font-bold">身分驗證中...</div>;

  // 🛡️ 驗證閘門介面
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-12 shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in">
          <div className="text-5xl mb-6">🛡️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">安全檢查</h1>
          <p className="text-gray-500 mb-8">為了保護帳號安全，請完成驗證以解鎖解答卡片。</p>
          <div className="flex justify-center mb-6">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={() => setIsVerified(true)}
            />
          </div>
          <p className="text-xs text-gray-400">當前身分：{userData?.seat_number} 號 {userData?.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-8 relative">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800">📖 學生解答大廳</h1>
          <div className="flex items-center gap-6">
            <div className="text-indigo-700 font-bold text-lg bg-indigo-50/50 px-4 py-1 rounded-full border border-indigo-100">
              {userData?.seat_number} 號 - {userData?.name}
            </div>
            <button onClick={handleLogout} className="bg-red-400 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md active:scale-95 transition-all">登出</button>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-10 shadow-lg min-h-[60vh]">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-gray-700">選擇科目</h2>
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)} 
              className="bg-white/60 border-none text-gray-700 rounded-[2rem] px-6 py-3 shadow-sm outline-none"
            >
              <option value="全部">所有科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSolutions.map((sol) => (
              <div 
                key={sol.id} 
                onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} 
                className="bg-white/50 hover:bg-white/80 border border-white/50 rounded-[3rem] p-8 cursor-pointer transition-all transform hover:-translate-y-2 group shadow-sm"
              >
                <div className="text-sm text-indigo-500 font-extrabold mb-3 uppercase">{sol.subject}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">{sol.title}</h3>
                <div className="text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">開啟解答 ➔</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-10">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 bg-white/50">
              <h3 className="text-xl font-bold text-gray-800">📄 解答預覽</h3>
              <button onClick={() => setViewingPreviewUrl(null)} className="h-12 w-12 rounded-full bg-gray-100 hover:bg-red-500 hover:text-white transition-all font-bold">✕</button>
            </div>
            <iframe src={viewingPreviewUrl} className="w-full h-full border-0 rounded-b-[3rem]" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, getDoc, writeBatch, 
  increment, serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile"; // 使用更穩定的版本

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 🛡️ 學生端驗證閘門狀態
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
      setViewingPreviewUrl(`https://drive.google.com/file/d/${driveFileId}/preview`);
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

  // 1. 檢查身分中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-teal-600 font-bold">
        確認身分中...
      </div>
    );
  }

  // 2. 🛡️ 學生端驗證畫面
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-12 shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in">
          <div className="text-5xl mb-6">🛡️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">安全檢查</h1>
          <p className="text-gray-500 mb-8">為了保護帳號安全，請先完成人機驗證以查看解答。</p>
          <div className="flex justify-center mb-6">
            <Turnstile
              sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={() => setIsVerified(true)}
            />
          </div>
          <p className="text-xs text-gray-400">登入同學：{userData?.seat_number} 號 {userData?.name}</p>
        </div>
      </div>
    );
  }

  // 3. 通過驗證後的解答大廳
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-8 relative">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        
        {/* 頂部標題 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">📖 學生解答大廳</h1>
          <div className="flex items-center gap-6">
            <div className="text-indigo-700 font-bold text-lg bg-indigo-50/50 px-4 py-1 rounded-full border border-indigo-100">
              {userData?.seat_number} 號 - {userData?.name}
            </div>
            <button onClick={handleLogout} className="bg-red-400 text-white px-5 py-2 rounded-[2rem] font-bold shadow-md">
              登出
            </button>
          </div>
        </div>

        {/* 解答內容 */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-10 shadow-lg min-h-[60vh]">
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <h2 className="text-xl font-bold text-gray-700">選擇你想查看的科目</h2>
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)} 
              className="bg-white/60 border-none text-gray-700 rounded-[2rem] px-6 py-3 shadow-sm outline-none"
            >
              <option value="全部">所有科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSolutions.map((sol) => (
              <div 
                key={sol.id} 
                onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} 
                className="bg-white/50 hover:bg-white/80 border border-white/50 rounded-[3rem] p-8 cursor-pointer transition-all transform hover:-translate-y-2 group shadow-sm"
              >
                <div className="text-sm text-indigo-500 font-extrabold mb-3 uppercase tracking-widest">{sol.subject}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">{sol.title}</h3>
                <div className="text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  開啟解答檔案 ➔
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 預覽 Modal */}
      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-10">
          <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 bg-white/50">
              <h3 className="text-xl font-bold text-gray-800">📄 解答預覽</h3>
              <button onClick={() => setViewingPreviewUrl(null)} className="h-12 w-12 rounded-full bg-gray-100 hover:bg-red-500 hover:text-white transition-all font-bold">✕</button>
            </div>
            <iframe src={viewingPreviewUrl} className="w-full h-full border-0 rounded-b-[3rem]" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}
