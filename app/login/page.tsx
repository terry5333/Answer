"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase"; 
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  // 狀態管理
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // 全域登入檢查
  const [loading, setLoading] = useState(false);             // 按鈕讀取狀態
  const [step, setStep] = useState<"login" | "bind">("login");
  const [seatNumber, setSeatNumber] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  
  // 🚀 新增：姓名偵測狀態
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 1. 自動登入通關機制
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === "teacher") {
            router.push("/admin");
            return;
          }
          if (userData.role === "student" && userData.seat_number) {
            router.push("/dashboard");
            return;
          }
        }
        // 如果有帳號但沒資料，進入綁定步驟
        setTempUser(user);
        setStep("bind");
        setIsCheckingAuth(false);
      } else {
        setIsCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. 🚀 自動偵測座號對應的名字
  useEffect(() => {
    const fetchName = async () => {
      if (seatNumber) {
        setIsSearching(true);
        try {
          const studentRef = doc(db, "students", seatNumber);
          const studentSnap = await getDoc(studentRef);
          if (studentSnap.exists()) {
            setDetectedName(studentSnap.data().name);
          } else {
            setDetectedName(null);
          }
        } catch (e) {
          setDetectedName(null);
        }
        setIsSearching(false);
      } else {
        setDetectedName(null);
      }
    };
    fetchName();
  }, [seatNumber]);

  // 3. 處理 Google 登入
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role === "teacher") {
          router.push("/admin");
          return;
        }
        if (userData.role === "student" && userData.seat_number) {
          router.push("/dashboard");
          return;
        }
      }
      setTempUser(user);
      setStep("bind");
      setLoading(false);
    } catch (error) {
      console.error("登入失敗:", error);
      setLoading(false);
      alert("登入失敗，請稍後再試。");
    }
  };

  // 4. 處理身分綁定
  const handleBindStudent = async () => {
    if (!seatNumber || !detectedName || !tempUser) return;
    setLoading(true);

    try {
      const studentRef = doc(db, "students", seatNumber);
      const studentSnap = await getDoc(studentRef);
      const studentData = studentSnap.data();

      if (studentData?.bound_uid && studentData.bound_uid !== tempUser.uid) {
        setLoading(false);
        return alert("❌ 此座號已被其他帳號綁定！");
      }

      // 更新學生名單資訊
      await updateDoc(studentRef, {
        bound_uid: tempUser.uid,
        bound_email: tempUser.email,
        photo_url: tempUser.photoURL
      });

      // 建立使用者權限資料
      await setDoc(doc(db, "users", tempUser.uid), {
        role: "student",
        seat_number: Number(seatNumber),
        name: studentData?.name || detectedName,
        email: tempUser.email
      });

      alert(`✅ 綁定成功！歡迎 ${detectedName} 同學。`);
      router.push("/dashboard");

    } catch (error) {
      console.error("綁定失敗", error);
      setLoading(false);
      alert("綁定時發生錯誤，請聯絡老師。");
    }
  };

  // 🚀 高質感轉圈圈過場
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-5">
          <svg className="animate-spin h-12 w-12 text-indigo-600 drop-shadow-sm" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-indigo-600 font-bold text-lg tracking-widest animate-pulse">確認身分中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center p-6 text-slate-800">
      <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 md:p-10 shadow-2xl w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in duration-500">
        
        <img src="/logo.png" alt="TerryEdu Logo" className="w-20 h-20 mb-6 drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
        <h1 className="text-2xl font-bold text-indigo-900 mb-8 tracking-wide">TerryEdu 雲端系統</h1>

        {step === "login" && (
          <div className="w-full flex flex-col gap-4">
            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="group w-full flex items-center justify-center gap-3 bg-white hover:bg-indigo-50 text-gray-700 font-bold py-4 px-6 rounded-[2rem] shadow-sm border border-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform" />
              {loading ? "處理中..." : "使用 Google 帳號登入"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-4 tracking-tighter">僅限授權的老師與學生登入使用</p>
          </div>
        )}

        {step === "bind" && (
          <div className="w-full flex flex-col gap-5 animate-in slide-in-from-right duration-500">
            <div className="text-center mb-2">
              <div className="text-indigo-600 font-bold mb-1 text-lg">歡迎，{tempUser?.displayName || "同學"}！</div>
              <div className="text-sm text-gray-500">請輸入座號完成最後一步</div>
            </div>

            <div className="relative">
              <input 
                type="number" 
                value={seatNumber} 
                onChange={(e) => setSeatNumber(e.target.value)} 
                placeholder="輸入座號 (如: 5)" 
                className="w-full bg-white/70 border-2 border-transparent focus:border-indigo-300 rounded-[2rem] px-6 py-4 text-center font-bold text-3xl outline-none shadow-inner transition-all"
              />
              {isSearching && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* 🚀 姓名偵測顯示區 */}
            <div className="min-h-[80px] flex items-center justify-center">
              {detectedName ? (
                <div className="bg-indigo-600/10 border border-indigo-200 rounded-[2rem] px-8 py-4 text-center animate-in zoom-in duration-300 w-full">
                  <span className="text-indigo-500 text-xs font-bold tracking-widest uppercase">身分確認</span>
                  <div className="text-indigo-800 font-black text-2xl mt-1 tracking-widest">✨ {detectedName} ✨</div>
                </div>
              ) : seatNumber ? (
                <div className="text-red-400 text-sm font-bold animate-pulse py-4 bg-red-50 w-full text-center rounded-[2rem] border border-red-100">
                  ⚠️ 找不到這個座號，請重新輸入
                </div>
              ) : (
                <div className="text-gray-400 text-sm italic py-4">請在上方輸入您的兩位數座號</div>
              )}
            </div>

            <button 
              onClick={handleBindStudent} 
              disabled={loading || !detectedName}
              className={`w-full font-bold py-4 px-6 rounded-[2rem] shadow-xl transition-all active:scale-95 text-lg ${
                detectedName 
                ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {loading ? "正在處理..." : detectedName ? `我是 ${detectedName}，確認綁定` : "請輸入正確座號"}
            </button>
            
            <button 
              onClick={() => { setStep("login"); setTempUser(null); setSeatNumber(""); }} 
              className="text-sm text-gray-400 hover:text-indigo-600 transition-colors mt-2 text-center font-medium"
            >
              ← 返回上一步
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
