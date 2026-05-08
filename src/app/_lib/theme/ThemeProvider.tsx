"use client";

/**
 * ThemeProvider.tsx — 自家製 Theme Provider (Garden v2.8a)
 *
 * 背景:
 *   - next-themes が npm install 拒否のため不在
 *   - native React Context + useState で同等機能を実装
 *   - Step 5 で user 承認後 next-themes 移行可能 (useTheme() API 後方互換維持)
 *
 * 仕様:
 *   - theme: "light" | "dark"
 *   - documentElement.setAttribute("data-theme", theme) で globals.css 発火
 *   - documentElement.classList.toggle("dark", theme === "dark") で next-themes 互換
 *   - localStorage キー `garden.theme` で永続化（default: "light"）
 *   - SSR safe: 初回 render は default、useEffect で復元
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "garden.theme";
const DEFAULT_THEME: Theme = "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDOM(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export type ThemeProviderProps = {
  children: ReactNode;
  /** 初期 theme override (test 用) */
  defaultTheme?: Theme;
};

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
}: ThemeProviderProps) {
  // SSR / 初回 render は default 固定 (hydration mismatch 回避)
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // mount 後に localStorage から復元
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeToDOM(stored);
    setMounted(true);
  }, []);

  // theme 変更時に DOM + localStorage 反映
  useEffect(() => {
    if (!mounted) return;
    applyThemeToDOM(theme);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore */
      }
    }
  }, [theme, mounted]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme — theme 状態を取得 / 操作するフック
 *
 * @returns { theme, setTheme, toggleTheme }
 * @throws ThemeProvider 外で呼ぶと Error
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
