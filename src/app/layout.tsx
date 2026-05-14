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
import { AuthProvider } from "./_lib/auth-unified";

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
      <head>
        {/* GardenShell preflight — body render 前に collapse / theme 状態を先取り → 初回 mount アニメーション抑止 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var nav=localStorage.getItem('garden_nav_pages_collapsed')==='1';
              var act=localStorage.getItem('garden_activity_collapsed')==='1';
              var th=localStorage.getItem('garden.theme');
              if(th==='dark')document.documentElement.setAttribute('data-theme','dark');
              document.documentElement.dataset.preNavCollapsed=nav?'1':'0';
              document.documentElement.dataset.preActivityCollapsed=act?'1':'0';
              // 初回 transition 抑止 (100ms scoped style)
              var s=document.createElement('style');
              s.id='garden-preflight-style';
              s.textContent='*,*::before,*::after{transition:none!important;animation:none!important;}';
              document.head.appendChild(s);
              var apply=function(){
                if(!document.body)return;
                document.body.classList.add('bloom-page');
                if(nav)document.body.classList.add('nav-pages-collapsed');
                if(act)document.body.classList.add('activity-collapsed');
              };
              if(document.body){apply();}else{document.addEventListener('DOMContentLoaded',apply);}
              // 150ms 後に preflight style を remove (transition 完全復活)
              setTimeout(function(){var el=document.getElementById('garden-preflight-style');if(el)el.remove();},150);
            }catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/*
          Provider 階層 (外側 → 内側):
          - AuthProvider: Garden Series 統一認証（2026-05-11、Task 1）
          - ThemeProvider: useTheme() / toggleTheme() を全 page から利用可能に
          - ShojiStatusProvider: 既存

          AuthProvider を最外側に置くことで、ThemeProvider / ShojiStatusProvider
          内部でも useAuthUnified() が利用可能になる。
        */}
        <AuthProvider>
          <ThemeProvider>
            <ShojiStatusProvider>{children}</ShojiStatusProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
