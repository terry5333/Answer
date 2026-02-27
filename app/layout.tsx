import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // 🚀 引入主題控制器

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TerryEdu 雲端教育系統",
  description: "極簡美感 (Clean UI) 的解答管理大廳",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 🚀 suppressHydrationWarning 必加，否則切換深色模式時會有警告
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
