"use client";

/**
 * 表示モード切替（👥みんな向け / ⚙️開発向け）
 *
 * §5.1 scaffold 準拠:
 *   - localStorage キー "bloom:viewMode"
 *   - 初期値 "simple"（みんな向け優先、会議共有を考慮）
 *   - ブラウザ間同期なし（個人設定扱い）
 *   - Context 経由で全画面に伝搬（props drilling 回避）
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ViewMode = "simple" | "detail";

const STORAGE_KEY = "bloom:viewMode";
const DEFAULT_MODE: ViewMode = "simple";

type ViewModeContextValue = {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  toggle: () => void;
  /** mode === "simple" のショートカット */
  simple: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(DEFAULT_MODE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "simple" || saved === "detail") {
        setModeState(saved);
      }
    } catch {
      // localStorage unavailable (private mode / SSR); keep default
    }
  }, []);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ViewMode = prev === "simple" ? "detail" : "simple";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({ mode, setMode, toggle, simple: mode === "simple" }),
    [mode, setMode, toggle],
  );

  return (
    <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used inside ViewModeProvider");
  }
  return ctx;
}

/**
 * Context 未提供環境でも動くフォールバック付き hook。
 * コンポーネント側でコンテキスト配下か不明なときに使用する。
 */
export function useViewModeOptional(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  return (
    ctx ?? {
      mode: DEFAULT_MODE,
      setMode: () => undefined,
      toggle: () => undefined,
      simple: DEFAULT_MODE === "simple",
    }
  );
}
