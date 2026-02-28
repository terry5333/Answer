"use client";
import { useEffect, useState } from "react";
import { db, auth, provider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import MaintenanceScreen from "@/components/MaintenanceScreen"; // 🚀 引入剛才的畫面

export default function LoginPage() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      // 1. 檢查維護狀態
      const maintenanceSnap = await getDoc(doc(db, "settings", "maintenance"));
      if (maintenanceSnap.exists() && maintenanceSnap.data().active) {
        setIsMaintenance(true);
      }
      setLoading(false);
    };
    checkStatus();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", result.user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().role === "teacher") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center">...</div>;
  
  // 🚀 如果維護中，直接顯示維護畫面且不放任何按鈕
  if (isMaintenance) return <MaintenanceScreen />;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
       {/* 這裡放你原本的登入 UI */}
       <button onClick={handleLogin} className="bg-white px-8 py-4 rounded-full font-black">Google 帳號登入</button>
    </div>
  );
}
