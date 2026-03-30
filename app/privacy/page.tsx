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
          <ArrowLeft size={18} /> 返回
        </button>
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex items-center gap-4 mb-8 text-teal-600">
            <ShieldCheck size={40} />
            <h1 className="text-3xl font-black italic">TerryEdu 隱私權政策</h1>
          </div>
          <div className="prose prose-slate max-w-none space-y-8 font-medium text-slate-600">
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4">1. 資訊蒐集聲明</h2>
              <p>TerryEdu 僅透過 Google OAuth 蒐集您的電子郵件地址、姓名及頭像網址。我們不會讀取您的 Google 雲端硬碟私密檔案、聯絡人或其他敏感資料。</p>
            </section>
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4">2. 應用程式用途</h2>
              <p>本系統用於管理本校國二學生的學習資源。蒐集之資料僅用於身分識別（確保本校學生存取）、顯示個人化介面以及記錄解答閱覽次數，以協助老師分析教學成效。</p>
            </section>
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4">3. 數據共享與保護</h2>
              <p>我們絕不會將您的資料分享、出售或轉讓給任何第三方廣告商。所有數據均存儲於受保護的 Firebase 環境中，並僅供管理員（教師）進行學術用途之數據分析。</p>
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
