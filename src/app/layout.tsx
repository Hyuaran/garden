import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/noto-serif-jp";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/500.css";
import "@fontsource/shippori-mincho/600.css";
import "@fontsource-variable/eb-garamond";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "./globals.css";
import { ShojiStatusProvider } from "../components/shared/ShojiStatusContext";
import { ThemeProvider } from "./_lib/theme/ThemeProvider";
import { AuthProvider } from "./_lib/auth-unified";

export const metadata: Metadata = {
  title: "Garden",
  description: "Garden シリーズ — 社内アプリケーション",
};

const initialThemeScript = `(() => {
  let theme = "light";
  try {
    const saved = window.localStorage.getItem("garden.theme");
    if (saved === "dark" || saved === "light") theme = saved;
  } catch {}
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = [GeistSans.variable, GeistMono.variable].join(" ");

  return (
    <html lang="ja" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
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
