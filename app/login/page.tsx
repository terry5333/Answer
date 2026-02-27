"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/lib/firebase"; 
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); 
  const [loading, setLoading] = useState(false);             
  const [step, setStep] = useState<"login" | "bind">("login");
  const [seatNumber, setSeatNumber] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  
  // 🚀 偵測狀態
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [isOccupied, setIsOccupied] = useState(false); // 新增：是否已被佔用
  const [isSearching, setIsSearching] = useState(false);

  // 1. 自動通關檢查
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.role === "teacher") { router.push("/admin"); return; }
            if (userData.role === "student" && userData.seat_number) { router.push("/dashboard"); return; }
          }
          setTempUser(user);
          setStep("bind");
        } catch (error) { console.error(error); }
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. 🚀 即時偵測姓名與「佔用狀態」
  useEffect(() => {
    const fetchStudentStatus = async () => {
      if (seatNumber) {
        setIsSearching(true);
        setIsOccupied(false);
        try {
          const studentRef = doc(db, "students", seatNumber);
          const studentSnap = await getDoc(studentRef);
          
          if (studentSnap.exists()) {
            const data = studentSnap.data();
            setDetectedName(data.name);
            
            // 🔥 關鍵判定：如果 bound_uid 存在且不是我，就是「被佔用」
            if (data.bound_uid && data.bound_uid !== tempUser?.uid) {
              setIsOccupied(true);
            }
          } else {
            setDetectedName(null);
          }
        } catch (e) {
          setDetectedName(null);
        }
        setIsSearching(false);
      } else {
        setDetectedName(null);
        setIsOccupied(false);
      }
    };
    const timer = setTimeout(fetchStudentStatus, 300);
    return () => clearTimeout(timer);
  }, [seatNumber, tempUser]);

  // 3. 處理登入
  const handleGoogleLogin = async () => {
    setLoading(true);
    try { await signInWithPopup(auth, provider); } 
    catch (error) { setLoading(false); alert("登入失敗"); }
  };

  // 4. 處理綁定
  const handleBindStudent = async () => {
    if (!seatNumber || !detectedName || isOccupied || !tempUser) return;
    setLoading(true);

    try {
      const studentRef = doc(db, "students", seatNumber);
      await updateDoc(studentRef, {
        bound_uid: tempUser.uid,
        bound_email: tempUser.email,
        photo_url: tempUser.photoURL || ""
      });

      await setDoc(doc(db, "users", tempUser.uid), {
        role: "student",
        seat_number: Number(seatNumber),
        name: detectedName,
        email: tempUser.email,
        uid: tempUser.uid
      });

      alert(`✅ 歡迎 ${detectedName} 同學！`);
      router.push("/dashboard");
    } catch (error) {
      setLoading(false);
      alert("系統忙碌中");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <svg className="animate-spin h-12 w-12 text-indigo-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-indigo-600 font-bold tracking-widest animate-pulse text-lg">TerryEdu 身分識別中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 flex items-center justify-center p-6 text-slate-800">
      <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[3rem] p-8 md:p-12 shadow-2xl w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in duration-500">
        
        <img src="/logo.png" alt="Logo" className="w-20 h-20 mb-6 drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
        <h1 className="text-2xl font-bold text-indigo-900 mb-8 tracking-wide">TerryEdu 雲端系統</h1>

        {step === "login" && (
          <div className="w-full flex flex-col gap-4">
            <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white hover:bg-indigo-50 text-gray-700 font-bold py-4 px-6 rounded-[2rem] shadow-sm border border-gray-200 transition-all active:scale-95 disabled:opacity-50">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
              {loading ? "登入中..." : "使用 Google 帳號登入"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-4">學生請先進行帳號綁定方可使用</p>
          </div>
        )}

        {step === "bind" && (
          <div className="w-full flex flex-col gap-5 animate-in slide-in-from-right duration-500">
            <div className="text-center">
              <div className="text-indigo-600 font-bold mb-1 text-lg">嗨，{tempUser?.displayName}</div>
              <div className="text-sm text-gray-500">請完成座號綁定</div>
            </div>

            <div className="relative">
              <input 
                type="number" 
                value={seatNumber} 
                onChange={(e) => setSeatNumber(e.target.value)} 
                placeholder="輸入座號" 
                className={`w-full bg-white/70 border-2 rounded-[2rem] px-6 py-5 text-center font-bold text-4xl outline-none shadow-inner transition-all ${isOccupied ? "border-red-300 text-red-500" : "border-transparent focus:border-indigo-300"}`}
              />
              {isSearching && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-6 w-6 text-indigo-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            <div className="min-h-[100px] flex items-center justify-center">
              {isOccupied ? (
                <div className="bg-red-50 border border-red-200 rounded-[2rem] px-8 py-5 text-center animate-in shake duration-300 w-full">
                  <span className="text-red-500 text-xs font-bold uppercase">⚠️ 無法綁定</span>
                  <div className="text-red-700 font-black text-xl mt-1 tracking-wider">此座號已被佔用</div>
                  <p className="text-[10px] text-red-400 mt-1">請聯絡老師解除綁定，或是確認座號</p>
                </div>
              ) : detectedName ? (
                <div className="bg-indigo-600/10 border border-indigo-200 rounded-[2rem] px-8 py-5 text-center animate-in zoom-in duration-300 w-full">
                  <span className="text-indigo-500 text-xs font-bold tracking-widest uppercase">系統身分確認</span>
                  <div className="text-indigo-800 font-black text-2xl mt-1 tracking-widest">✨ {detectedName} ✨</div>
                </div>
              ) : seatNumber ? (
                <div className="text-red-400 text-sm font-bold py-4 bg-red-50 w-full text-center rounded-[2rem] border border-red-100">
                  ⚠️ 找不到此座號
                </div>
              ) : (
                <div className="text-gray-400 text-sm italic py-4">請在上方輸入您的座號</div>
              )}
            </div>

            <button 
              onClick={handleBindStudent} 
              disabled={loading || !detectedName || isOccupied}
              className={`w-full font-bold py-5 px-6 rounded-[2rem] shadow-xl transition-all active:scale-95 text-lg ${
                !detectedName || isOccupied
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
              }`}
            >
              {loading ? "處理中..." : isOccupied ? "無法綁定" : detectedName ? `我是 ${detectedName}，確認綁定` : "請先輸入座號"}
            </button>
            
            <button onClick={() => { auth.signOut(); setStep("login"); setSeatNumber(""); }} className="text-sm text-gray-400 hover:text-red-500 transition-colors mt-2 text-center">
              ← 使用其他帳號登入
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
