import { redirect } from "next/navigation";

export default function HomePage() {
  // 當使用者訪問根目錄 "/" 時，直接自動跳轉到登入頁面
  redirect("/login");
}
