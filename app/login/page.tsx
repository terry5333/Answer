"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          router.push(role === "teacher" ? "/admin" : "/dashboard");
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: result.user.displayName,
          email: result.user.email,
          role: "student",
          seat_number: null,
          created_at: new Date()
        });
      }
    } catch (error) {
      console.error("登入失敗:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2rem] shadow-xl w-full max-w-md text-center border border-slate-100 dark:border-slate-800">
        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">
          系統登入
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">
          請點擊下方按鈕，使用 Google 帳號登入系統
        </p>
        
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn size={20} />
              <span>Google 帳號登入</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
