import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  EB_Garamond,
  Cormorant_Garamond,
  Shippori_Mincho,
  Noto_Serif_JP,
} from "next/font/google";
import "./globals.css";
import { ShojiStatusProvider } from "../components/shared/ShojiStatusContext";
import { ThemeProvider } from "./_lib/theme/ThemeProvider";

// === 既存フォント（維持） ===
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// === v2.8a 追加フォント (DESIGN_SPEC §2-1 / §2-2) ===
// 数字専用 (KPI / トレンド / 時刻): tnum + lnum 公式サポート
const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// 中見出し / ブランド名 / 英字
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// 大見出し（挨拶等） — 第1選択
const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// 日本語本文 / 大見出し第2選択
const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Garden",
  description: "Garden シリーズ — 社内アプリケーション",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = [
    geistSans.variable,
    geistMono.variable,
    ebGaramond.variable,
    cormorantGaramond.variable,
    shipporiMincho.variable,
    notoSerifJp.variable,
  ].join(" ");

  return (
    <html lang="ja" className={`${fontVariables} h-full antialiased`} data-theme="light">
      <body className="min-h-full flex flex-col">
        {/*
          v2.8a Step 5: ThemeProvider で wrap
          - useTheme() / toggleTheme() を全 page から利用可能に
          - 既存 ShojiStatusProvider は ThemeProvider 内側で維持
        */}
        <ThemeProvider>
          <ShojiStatusProvider>{children}</ShojiStatusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
