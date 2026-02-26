"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatNumber, setSeatNumber] = useState("");
  const [tempUser, setTempUser] = useState<any>(null);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    if (!turnstileToken) return;
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        router.push("/dashboard");
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

  const handleSaveSeatNumber = async () => {
    if (!seatNumber || !tempUser) return;
    setLoading(true);

    try {
      await setDoc(doc(db, "users", tempUser.uid), {
        uid: tempUser.uid,
        email: tempUser.email,
        role: "student", 
        seat_number: Number(seatNumber),
        createdAt: new Date(),
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("儲存座號失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4">
      <div className="w-full max-w-md bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] p-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">作業解答平台</h1>
        <p className="text-gray-500 mb-8 text-center">請先完成驗證並登入 Google 帳號</p>

        <div className="mb-6 rounded-[2rem] overflow-hidden">
          <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={setTurnstileToken} />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={!turnstileToken || loading}
          className={`w-full py-4 px-6 rounded-[3rem] font-semibold text-white transition-all duration-300 ${
            !turnstileToken || loading ? "bg-gray-400 cursor-not-allowed opacity-70" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg"
          }`}
        >
          {loading ? "處理中..." : "使用 Google 帳號登入"}
        </button>
      </div>

      {showSeatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-2xl p-10 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">歡迎加入！</h2>
            <p className="text-gray-600 mb-6 text-center">為了方便老師管理，請輸入專屬座號。</p>
            <input
              type="number"
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder="請輸入座號 (例: 15)"
              className="w-full bg-white/50 border border-gray-300 text-gray-800 text-center text-lg rounded-[3rem] px-6 py-4 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveSeatNumber}
              disabled={!seatNumber || loading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-[3rem] transition-all shadow-lg disabled:opacity-50"
            >
              確認送出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
