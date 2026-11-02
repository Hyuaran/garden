"use client";
import { useStoredView } from "@/lib/ui/useStoredView";

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
  const [mode,setMode,viewReady]=useStoredView<ViewMode>(STORAGE_KEY,DEFAULT_MODE,raw=>raw==="detail"?"detail":"simple",value=>value);
  const toggle=useCallback(()=>setMode(previous=>previous==="simple"?"detail":"simple"),[setMode]);
  const value = useMemo<ViewModeContextValue>(
    () => ({ mode, setMode, toggle, simple: mode === "simple" }),
    [mode, setMode, toggle],
  );

  return (
    <ViewModeContext.Provider value={value}><div style={{visibility:viewReady?"visible":"hidden",display:"contents"}}>{children}</div></ViewModeContext.Provider>
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
