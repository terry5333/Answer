"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight, Moon, Sun, AlertTriangle } from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [userData, setUserData] = useState<any>(null);
  const [viewingPreviewUrl, setViewingPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      
      try {
        const [userSnap, mSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "settings", "maintenance"))
        ]);

        if (!userSnap.exists() || !userSnap.data().seat_number) {
          router.push("/login"); return;
        }

        const isTeacher = userSnap.data().role === "teacher";
        const seatNumber = userSnap.data().seat_number;

        // 🚀 維護模式攔截邏輯
        if (mSnap.exists() && mSnap.data().active && !isTeacher) {
          const testers = mSnap.data().testers || [];
          if (!testers.includes(seatNumber)) {
            setIsBlocked(true);
            setLoading(false);
            return;
          }
        }

        const studentSnap = await getDoc(doc(db, "students", String(seatNumber)));
        setUserData({ ...userSnap.data(), name: studentSnap.exists() ? studentSnap.data().name : userSnap.data().name });
        const solSnap = await getDocs(collection(db, "solutions"));
        setSolutions(solSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  // 🚀 修復後的維護畫面（確保不只顯示膠囊）
  if (isBlocked) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 transition-colors">
      <div className="bg-slate-900 p-12 rounded-[3.5rem] border-4 border-orange-500 text-center max-w-md w-full shadow-2xl">
        <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl"><AlertTriangle size={40} /></div>
        <h1 className="text-2xl font-black mb-4 text-white italic">系統維護中</h1>
        <p className="text-slate-400 font-bold mb-10 leading-relaxed text-sm">目前正在進行數據調優。請等候開放。</p>
        <div className="py-2 px-6 bg-slate-800 rounded-full inline-block"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Restricted</span></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/80 p-4 md:p-8 pb-20 relative overflow-hidden transition-colors duration-500">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header 與 解答列表內容保持不變 */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-700/50 rounded-[2.5rem] p-4 md:p-6 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-teal-500 rounded-2xl flex items-center justify-center text-white"><BookOpen size={20} /></div><h1 className="text-lg font-black dark:text-white">TerryEdu 解答大廳</h1></div>
          <button onClick={() => { signOut(auth); router.push("/login"); }} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.filter(s => selectedSubject === "全部" || s.subject === selectedSubject).map(sol => (
            <div key={sol.id} onClick={() => {
              const url = sol.file_url ? sol.file_url.replace(/\/view.*/, "/preview") : `https://drive.google.com/file/d/${sol.drive_file_id}/preview`;
              setViewingPreviewUrl(url);
            }} className="bg-white/60 dark:bg-slate-900/50 p-8 rounded-[3rem] border border-white dark:border-slate-700/50 shadow-lg cursor-pointer hover:scale-[1.02] transition-all">
              <div className="text-[10px] text-teal-600 font-black mb-3 uppercase bg-teal-50 px-3 py-1 rounded-full w-fit">{sol.subject}</div>
              <h3 className="font-black text-lg dark:text-white">{sol.title}</h3>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={() => setViewingPreviewUrl(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white dark:bg-slate-900 rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-5xl h-[95vh] flex flex-col relative z-10 overflow-hidden shadow-2xl">
               <div className="p-6 flex justify-between border-b dark:border-slate-800"><span className="font-black dark:text-white">解答預覽</span><button onClick={() => setViewingPreviewUrl(null)} className="font-black text-red-500">關閉</button></div>
               <iframe src={viewingPreviewUrl} className="flex-1 w-full border-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
