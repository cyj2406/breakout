import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INU 벽돌깨기",
  description: "인천대학교 디자인학부 최유정의 벽돌깨기 게임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
