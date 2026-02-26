"use client";

import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // 新增：用來控制「正在檢查記憶體」的載入畫面
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatNumber, setSeatNumber] = useState("");
  const [studentNameInfo, setStudentNameInfo] = useState<string | null>(null);
  const [tempUser, setTempUser] = useState<any>(null);
  const router = useRouter();

  // 🚀 新增的核心邏輯：一進來就先檢查 Firebase 有沒有記住這個人
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 如果 Firebase 記得這個人，去資料庫查他的權限
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const role = userSnap.data().role;
          // 自動分流：老師去後台，學生去前台
          if (role === "teacher") {
            router.push("/admin");
          } else {
            router.push("/dashboard");
          }
        } else {
          // 有 Google 帳號，但還沒綁定座號姓名 (首次登入中斷的情況)
          setTempUser(user);
          setShowSeatModal(true);
          setIsCheckingAuth(false);
        }
      } else {
        // 真的沒登入過，或是登出了，才顯示登入按鈕
        setIsCheckingAuth(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    if (!turnstileToken) return;
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const role = userSnap.data().role;
        if (role === "teacher") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        setTempUser(user);
        setShowSeatModal(true);
      }
    } catch (error) {
      console.error("登入失敗:", error);
      alert("登入失敗，請重試。");
    } finally {
      setLoading(false);
    }
  };

  const handleSeatChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const seat = e.target.value;
    setSeatNumber(seat);
    setStudentNameInfo(null);
    
    if (seat) {
      const stuRef = doc(db, "students", seat);
      const stuSnap = await getDoc(stuRef);
      if (stuSnap.exists()) {
        setStudentNameInfo(stuSnap.data().name);
      } else {
        setStudentNameInfo("找不到此座號");
      }
    }
  };

  const handleSaveSeatNumber = async () => {
    if (!seatNumber || !tempUser || !studentNameInfo || studentNameInfo === "找不到此座號") return;
    setLoading(true);

    try {
      await setDoc(doc(db, "users", tempUser.uid), {
        uid: tempUser.uid,
        email: tempUser.email,
        role: "student", 
        seat_number: Number(seatNumber),
        name: studentNameInfo,
        createdAt: new Date(),
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("儲存失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 如果還在檢查記憶體中的登入狀態，先顯示一個過場動畫，避免畫面閃爍
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100">
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-10 shadow-lg flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-bold">驗證身分與權限中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4">
      <div className="w-full max-w-md bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] p-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">作業解答平台</h1>
        <p className="text-gray-500 mb-8 text-center">請先完成驗證並登入 Google 帳號</p>

        <div className="mb-6 rounded-[2rem] overflow-hidden">
          <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={setTurnstileToken} />
        </div>

        <button onClick={handleGoogleLogin} disabled={!turnstileToken || loading} className={`w-full py-4 px-6 rounded-[3rem] font-semibold text-white transition-all duration-300 ${!turnstileToken || loading ? "bg-gray-400 cursor-not-allowed opacity-70" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg"}`}>
          {loading ? "處理中..." : "使用 Google 帳號登入"}
        </button>
      </div>

      {showSeatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-2xl p-10 w-full max-w-sm flex flex-col items-center animate-in zoom-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">歡迎加入！</h2>
            <p className="text-gray-600 mb-6 text-center">請輸入老師為你設定的專屬座號。</p>
            
            <input type="number" value={seatNumber} onChange={handleSeatChange} placeholder="請輸入座號 (例: 15)" className="w-full bg-white/50 border border-gray-300 text-gray-800 text-center text-lg rounded-[3rem] px-6 py-4 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            
            <div className="h-8 mb-4 font-bold text-lg flex items-center justify-center">
              {studentNameInfo === "找不到此座號" ? (
                <span className="text-red-500 text-sm">⚠️ 查無此座號，請與老師確認</span>
              ) : studentNameInfo ? (
                <span className="text-teal-600">你是 {studentNameInfo} 嗎？</span>
              ) : null}
            </div>

            <button onClick={handleSaveSeatNumber} disabled={!seatNumber || loading || !studentNameInfo || studentNameInfo === "找不到此座號"} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-[3rem] transition-all shadow-lg disabled:opacity-50">
              確認送出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
