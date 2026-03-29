import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "弈战 v2.4 · 商业博弈 Demo",
  description: "4人5回合同步亮牌商业策略博弈游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-stone-950">{children}</body>
    </html>
  );
}
