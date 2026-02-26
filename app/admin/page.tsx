"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().role !== "teacher") {
        alert("權限不足，僅限老師進入");
        return router.push("/dashboard");
      }
      fetchAdminData();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAdminData = async () => {
    const solSnap = await getDocs(query(collection(db, "solutions"), orderBy("view_count", "desc")));
    setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const logSnap = await getDocs(query(collection(db, "view_logs"), orderBy("viewed_at", "desc"), limit(20)));
    setViewLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        alert("上傳成功！");
        fetchAdminData();
        (e.target as HTMLFormElement).reset();
      } else {
        alert("上傳失敗");
      }
    } catch (error) {
      console.error("上傳錯誤", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-6 px-10 shadow-lg">
          <h1 className="text-3xl font-bold text-indigo-900">👨‍🏫 老師管理中控台</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg h-fit">
            <h2 className="text-xl font-bold text-gray-800 mb-6">📤 上傳新解答</h2>
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <input name="subject" required placeholder="科目 (例: 數學)" className="bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 focus:outline-none" />
              <input name="title" required placeholder="標題 (例: 1-1 習作解答)" className="bg-white/50 border border-gray-300 rounded-[2rem] px-5 py-3 focus:outline-none" />
              <input type="file" name="file" required className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 ml-2" />
              <button disabled={isUploading} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-[3rem] shadow-lg disabled:opacity-50">
                {isUploading ? "上傳中..." : "確認上傳"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🔥 學生易錯題目排行</h2>
              <div className="space-y-3">
                {solutions.map((sol, index) => (
                  <div key={sol.id} className="flex justify-between items-center bg-white/50 rounded-[2rem] px-6 py-4">
                    <span className="font-bold text-gray-700"><span className="text-indigo-500 mr-2">#{index + 1}</span> [{sol.subject}] {sol.title}</span>
                    <span className="bg-orange-100 text-orange-600 font-bold px-4 py-1 rounded-full">{sol.view_count || 0} 次</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">👀 最新觀看動態</h2>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-sm border-b border-gray-200">
                    <th className="pb-3 pl-4">座號</th>
                    <th className="pb-3">解答 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100/50 hover:bg-white/40">
                      <td className="py-3 pl-4 font-bold text-indigo-600">{log.seat_number} 號</td>
                      <td className="py-3 text-gray-600 text-sm">{log.solution_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
