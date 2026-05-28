import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Whalyx — AI 주식 투자 인텔리전스",
  description: "시장이 흔들리는 순간, 무엇을 사고 팔지 AI가 함께 읽는다. ETF·주식 매매 시그널, 외국인 매매, 한미 금리, 내 포트폴리오까지 한 화면에서 보는 AI 주식 투자 파트너.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://whalyx.onrender.com" />
        <link rel="dns-prefetch" href="https://whalyx.onrender.com" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen">
        <LanguageProvider>
          <ServiceWorkerRegister />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
