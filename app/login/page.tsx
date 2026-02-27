import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// ... 前面的 Google 登入邏輯 ...

const handleGoogleLogin = async () => {
  try {
    // 假設你使用了 signInWithPopup(auth, provider)
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // 1. 檢查使用者是否已經在 users 集合中（判斷是否為老學生/老師）
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      
      // 🚀【核心修復區】自動修復舊學生的綁定狀態
      if (userData.role === "student" && userData.seat_number) {
        try {
          const studentRef = doc(db, "students", String(userData.seat_number));
          // 無論如何，確保 students 表裡的 bound_uid 有對應到這個 Google 帳號
          await updateDoc(studentRef, {
            bound_uid: user.uid,
            bound_email: user.email
          });
        } catch (err) {
          console.log("自動修復綁定狀態時發生小錯誤，但不影響登入", err);
        }
        
        router.push("/dashboard");
        return;
      }

      if (userData.role === "teacher") {
        router.push("/admin");
        return;
      }
    } else {
      // 2. 如果是全新的帳號，走首次綁定流程
      // ... 這裡放你原本輸入座號並註冊的邏輯 ...
    }

  } catch (error) {
    console.error("登入失敗:", error);
  }
};
