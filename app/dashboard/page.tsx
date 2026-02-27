"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile"; 

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      // 🚀 核心守門邏輯：檢查 Firestore 是否有綁定資料
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || !userSnap.data().seat_number) {
        // ❌ 沒綁定座號，或是根本沒名單，踢出去！
        alert("尚未完成座號綁定，請先進行綁定。");
        router.push("/login");
        return;
      }

      setUserData(userSnap.data());
      fetchSolutions();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSolutions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "solutions"));
      setSolutions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
  };

  const handleViewSolution = async (solutionId: string, driveFileId: string) => {
    if (!userData) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "solutions", solutionId), { view_count: increment(1) });
    batch.set(doc(collection(db, "view_logs")), {
      student_uid: auth.currentUser?.uid,
      seat_number: userData.seat_number,
      solution_id: solutionId,
      viewed_at: serverTimestamp()
    });
    await batch.commit();
    setViewingPreviewUrl(`https://drive.google.com/file/d/${driveFileId}/preview`);
  };

  const handleLogout = async () => { await signOut(auth); router.push("/login"); };

  const sortedSolutions = solutions
    .filter(s => selectedSubject === "全部" || s.subject === selectedSubject)
    .sort((a, b) => a.subject.localeCompare(b.subject, 'zh-TW'));

  // 🔄 轉圈圈動畫
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <svg className="animate-spin h-12 w-12 text-teal-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-teal-600 font-bold animate-pulse">身分檢查中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4 md:p-8">
      {!isVerified ? (
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="bg-white/60 backdrop-blur-xl p-10 rounded-[3rem] text-center shadow-2xl border border-white">
            <h1 className="text-xl font-bold mb-6">🛡️ 安全驗證</h1>
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="bg-white/40 backdrop-blur-xl border border-white rounded-[2.5rem] p-5 flex justify-between items-center shadow-lg">
            <h1 className="text-lg font-bold">📖 學生解答大廳</h1>
            <div className="flex items-center gap-3">
              <img src={auth.currentUser?.photoURL || ""} className="w-8 h-8 rounded-full border-2 border-white" />
              <span className="font-bold text-sm">{userData?.seat_number} 號 {userData?.name}</span>
              <button onClick={handleLogout} className="bg-red-400 text-white px-4 py-2 rounded-full text-xs font-bold">登出</button>
            </div>
          </div>
          <div className="bg-white/40 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 min-h-[60vh]">
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full sm:w-auto mb-6 bg-white/70 border border-white rounded-full px-4 py-2 font-bold outline-none">
              <option value="全部">🔍 全部科目</option>
              {Array.from(new Set(solutions.map(s => s.subject))).map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedSolutions.map(sol => (
                <div key={sol.id} onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} className="bg-white/50 p-6 rounded-[2rem] hover:bg-white/80 transition-all cursor-pointer shadow-sm">
                  <div className="text-xs text-indigo-500 font-bold mb-2">{sol.subject}</div>
                  <h3 className="font-bold">{sol.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {viewingPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 flex justify-between border-b">
              <span className="font-bold">解答預覽</span>
              <button onClick={() => setViewingPreviewUrl(null)} className="font-bold">✕</button>
            </div>
            <iframe src={viewingPreviewUrl} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
