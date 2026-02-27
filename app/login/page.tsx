"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase"; 
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  // 🚀 新增：一進網站時的「偷偷檢查」狀態
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [step, setStep] = useState<"login" | "bind">("login");
  const [seatNumber, setSeatNumber] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);

  // 🚀 核心修復：自動刷臉通關機制
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Firebase 發現這個人已經登入過！直接去查權限
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
        // 如果有帳號但資料不全，跳到綁定頁面
        setTempUser(user);
        setStep("bind");
        setIsCheckingAuth(false);
      } else {
        // 確實沒有登入紀錄，關閉檢查畫面，顯示 Google 登入按鈕
        setIsCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

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
        if (userData.role === "student") {
          if (userData.seat_number) {
            const studentRef = doc(db, "students", String(userData.seat_number));
            const studentSnap = await getDoc(studentRef);
            if (studentSnap.exists()) {
              const studentData = studentSnap.data();
              if (!studentData.bound_uid || studentData.bound_uid === user.uid) {
                await updateDoc(studentRef, {
                  bound_uid: user.uid,
                  bound_email: user.email,
                  photo_url: user.photoURL
                });
                router.push("/dashboard");
                return;
              }
            }
          }
          setTempUser(user);
          setStep("bind");
          setLoading(false);
          return;
        }
      } else {
        setTempUser(user);
        setStep("bind");
        setLoading(false);
      }
    } catch (error) {
      console.error("登入失敗:", error);
      setLoading(false);
      alert("登入失敗，請稍後再試。");
    }
  };

  const handleBindStudent = async () => {
    if (!seatNumber || !tempUser) return alert("請輸入座號！");
    setLoading(true);

    try {
      const studentRef = doc(db, "students", seatNumber);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        setLoading(false);
        return alert("找不到此座號，請聯絡老師新增名單！");
      }

      const studentData = studentSnap.data();

      if (studentData.bound_uid && studentData.bound_uid !== tempUser.uid) {
        setLoading(false);
        return alert("❌ 此座號已被其他 Google 帳號綁定！如果您選錯了，請聯絡老師。");
      }

      await updateDoc(studentRef, {
        bound_uid: tempUser.uid,
        bound_email: tempUser.email,
        photo_url: tempUser.photoURL
      });

      await setDoc(doc(db, "users", tempUser.uid), {
        role: "student",
        seat_number: Number(seatNumber),
        name: studentData.name,
        email: tempUser.email
      });

      alert("✅ 綁定成功！歡迎進入 TerryEdu。");
      router.push("/dashboard");

    } catch (error) {
      console.error("綁定失敗", error);
      setLoading(false);
      alert("綁定時發生錯誤，請聯絡老師。");
    }
  };

  // 🚀 如果系統還在檢查登入狀態，顯示過場動畫，不讓學生看到按鈕
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <img src="/logo.png" alt="TerryEdu" className="w-16 h-16 drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
          <div className="text-indigo-600 font-bold text-lg tracking-widest">確認身分中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center p-6">
      <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-10 shadow-2xl w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in">
        
        <img src="/logo.png" alt="TerryEdu Logo" className="w-20 h-20 mb-6 drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
        <h1 className="text-2xl font-bold text-indigo-900 mb-8 tracking-wide">登入 TerryEdu</h1>

        {step === "login" && (
          <div className="w-full flex flex-col gap-4">
            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-[2rem] shadow-sm border border-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
              {loading ? "處理中..." : "使用 Google 帳號登入"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-4">僅限授權的老師與學生登入使用</p>
          </div>
        )}

        {step === "bind" && (
          <div className="w-full flex flex-col gap-5 animate-in slide-in-from-right">
            <div className="text-center mb-2">
              <div className="text-indigo-600 font-bold mb-1">歡迎，{tempUser?.displayName || "同學"}！</div>
              <div className="text-sm text-gray-500">系統未找到您的完整紀錄，請綁定座號。</div>
            </div>

            <input 
              type="number" 
              value={seatNumber} 
              onChange={(e) => setSeatNumber(e.target.value)} 
              placeholder="請輸入您的座號 (例如: 5)" 
              className="w-full bg-white/50 border border-gray-300 rounded-[2rem] px-6 py-4 text-center font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
            />

            <button 
              onClick={handleBindStudent} 
              disabled={loading || !seatNumber}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-[2rem] shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "綁定中..." : "確認綁定"}
            </button>
            
            <button onClick={() => { setStep("login"); setTempUser(null); }} className="text-sm text-gray-500 hover:text-indigo-600 transition-colors mt-2">
              返回上一步
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
