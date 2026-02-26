import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "作業解答分享平台",
  description: "專屬作業解答與學生管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
