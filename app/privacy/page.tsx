"use client";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-50 p-8 md:p-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-teal-600 font-bold mb-10 transition-colors">
          <ArrowLeft size={18} /> 返回首頁
        </button>
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 text-slate-600">
          <div className="flex items-center gap-4 mb-8 text-teal-600">
            <ShieldCheck size={40} />
            <h1 className="text-3xl font-black italic text-slate-800">TerryEdu 隱私權政策</h1>
          </div>
          <div className="space-y-8 font-medium">
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4">資料蒐集與用途</h2>
              <p>我們僅透過 Google OAuth 蒐集您的姓名、電子郵件與頭像網址，用於確認學生身分。系統會記錄解答閱覽紀錄，協助老師分析學習進度。</p>
            </section>
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4">數據共享聲明</h2>
              <p>TerryEdu 承諾絕不將您的個人資料分享、出售或轉讓給任何第三方機構或廣告商。所有數據僅供校內教學管理使用。</p>
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
