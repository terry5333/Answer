"use client";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function MaintenanceScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 transition-colors">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border-4 border-orange-500 text-center max-w-md w-full">
        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-2xl font-black mb-4 text-slate-800 dark:text-slate-100 italic">TerryEdu 維護中</h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 leading-relaxed text-sm">
          目前系統正在進行硬體升級或功能調優，暫時關閉所有存取權限。<br/>請耐心等候老師通知開放。
        </p>
        <div className="py-2 px-6 bg-slate-100 dark:bg-slate-800 rounded-full inline-block">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Under Construction</span>
        </div>
      </motion.div>
    </div>
  );
}
