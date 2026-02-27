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
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, LogOut, FileText, ChevronRight } from "lucide-react";

// 動態定義：卡片交錯進場
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { y: 25, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

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
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || !userSnap.data().seat_number) {
        alert("⚠️ 請先完成身分綁定！");
        router.push("/login");
        return;
      }
      setUserData(userSnap.data());
      await fetchSolutions();
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
    try {
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
    } catch (e) { console.error(e); }
  };

  const sortedSolutions = solutions
    .filter(s => selectedSubject === "全部" || s.subject === selectedSubject)
    .sort((a, b) => a.subject.localeCompare(b.subject, 'zh-TW'));

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 pb-20 relative overflow-hidden text-slate-800">
      
      {/* 🔮 Vibe 背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-teal-100/30 blur-[100px] rounded-full" />
        <motion.div animate={{ x: [0, -40, 0], y: [0, 60, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-100/30 blur-[120px] rounded-full" />
      </div>

      {!isVerified ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="min-h-[80vh] flex items-center justify-center">
          <div className="bg-white/70 backdrop-blur-2xl p-10 rounded-[3rem] text-center shadow-2xl border border-white max-w-sm w-full">
            <h1 className="text-xl font-black mb-6 text-indigo-900 flex items-center justify-center gap-2"><BookOpen className="w-6 h-6" /> 安全驗證</h1>
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={() => setIsVerified(true)} />
          </div>
        </motion.div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-4 md:p-6 flex justify-between items-center shadow-xl shadow-teal-900/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><BookOpen className="w-5 h-5" /></div>
              <h1 className="text-lg md:text-xl font-black tracking-tight hidden sm:block">TerryEdu 解答大廳</h1>
              <h1 className="text-lg font-black tracking-tight sm:hidden">解答大廳</h1>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 bg-white/50 p-1.5 pr-4 rounded-full border border-white/50">
              <img src={auth.currentUser?.photoURL || ""} className="w-8 h-8 rounded-full border border-white" referrerPolicy="no-referrer" />
              <div className="flex flex-col text-left">
                <span className="font-black text-xs md:text-sm leading-none">{userData?.seat_number} 號 {userData?.name}</span>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { signOut(auth); router.push("/login"); }} className="ml-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-4 h-4" /></motion.button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-2">
            <div className="relative w-full sm:w-auto">
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full sm:w-auto appearance-none bg-white/70 backdrop-blur-md border border-white rounded-full px-8 py-3.5 font-bold outline-none shadow-lg shadow-teal-900/5 cursor-pointer text-sm">
                <option value="全部">🔍 全部科目</option>
                {Array.from(new Set(solutions.map(s => s.subject))).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronRight className="w-4 h-4 text-slate-400 rotate-90" /></div>
            </div>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {sortedSolutions.map(sol => (
              <motion.div key={sol.id} variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleViewSolution(sol.id, sol.drive_file_id)} className="group bg-white/60 backdrop-blur-md p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-lg hover:shadow-2xl hover:bg-white/90 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="text-[10px] md:text-xs text-teal-600 font-black mb-3 tracking-[0.2em] uppercase bg-teal-50 self-start px-3 py-1 rounded-full w-fit">{sol.subject}</div>
                    <h3 className="font-black text-lg md:text-xl text-slate-800 leading-tight group-hover:text-teal-700 transition-colors">{sol.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold"><FileText className="w-3 h-3" /> PDF 解答</div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-all shadow-inner"><ChevronRight className="w-4 h-4" /></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* 🚀 解答預覽 Modal */}
      <AnimatePresence>
        {viewingPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingPreviewUrl(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg" />
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 250, damping: 30 }} className="bg-white rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-5xl h-[95vh] md:h-[85vh] flex flex-col overflow-hidden shadow-2xl relative z-10">
              <div className="p-5 md:p-8 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 rounded-xl"><BookOpen className="w-5 h-5 text-teal-600" /></div>
                  <span className="font-black text-base md:text-lg text-slate-800">正在查閱解答</span>
                </div>
                <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.8 }} onClick={() => setViewingPreviewUrl(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-red-500 hover:text-white rounded-full font-bold transition-all">✕</motion.button>
              </div>
              <div className="flex-1 w-full bg-slate-200">
                <iframe src={viewingPreviewUrl} className="w-full h-full border-none" allow="autoplay" title="PDF Preview" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
