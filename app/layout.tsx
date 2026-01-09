import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "JarsonCai's Assistant",
  description: "为创新赋能，与智慧同行",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Sidebar />
        <main className="ml-[60px]">{children}</main>
      </body>
    </html>
  );
}
