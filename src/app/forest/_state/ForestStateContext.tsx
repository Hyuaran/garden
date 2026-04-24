"use client";

/**
 * Garden-Forest 全体の共有状態
 *
 * - Garden Auth セッション
 * - Forest 権限（forest_users）
 * - Forest ゲート状態（パスワード再入力済みか）
 * - 2時間セッションタイマー
 * - データ（companies, periods, shinkouki）
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

import type { Company, FiscalPeriod, ForestUser, Shinkouki } from "../_constants/companies";
import { clearForestUnlock, getSession, isForestUnlocked, signOutForest } from "../_lib/auth";
import { writeAuditLog } from "../_lib/audit";
import { fetchCompanies, fetchFiscalPeriods, fetchForestUser, fetchShinkouki } from "../_lib/queries";
import { startSessionTimer } from "../_lib/session-timer";

type ForestState = {
  /** ローディング中 */
  loading: boolean;
  /** Garden Auth 済み */
  isAuthenticated: boolean;
  /** forest_users に登録済み */
  hasPermission: boolean;
  /** Forest パスワードゲート通過済み（2h 有効） */
  isUnlocked: boolean;
  /** 現在のユーザー情報 */
  userEmail: string | null;
  forestUser: ForestUser | null;
  /** データ */
  companies: Company[];
  periods: FiscalPeriod[];
  shinkouki: Shinkouki[];
  /** 操作 */
  unlock: () => void;
  lockAndLogout: (reason: "manual" | "timeout") => Promise<void>;
  refreshData: () => Promise<void>;
  /**
   * ログイン成功後に呼ぶ：セッション + forest_user を再取得してゲートを解錠。
   * 権限なし（forest_users 未登録）の場合は signOut して error を返す。
   */
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
};

const ForestStateContext = createContext<ForestState | null>(null);

export function useForestState(): ForestState {
  const ctx = useContext(ForestStateContext);
  if (!ctx) throw new Error("useForestState must be used inside ForestStateProvider");
  return ctx;
}

export function ForestStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [forestUser, setForestUser] = useState<ForestUser | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [shinkoukiData, setShinkoukiData] = useState<Shinkouki[]>([]);

  // --- Callbacks（useEffect より先に定義） ---

  const unlock = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  const lockAndLogoutFn = useCallback(async (reason: "manual" | "timeout") => {
    const action = reason === "manual" ? "logout_manual" : "logout_timeout";
    await writeAuditLog(action);
    await signOutForest();
    setIsAuthenticated(false);
    setHasPermission(false);
    setIsUnlocked(false);
    setUserEmail(null);
    setForestUser(null);
    setCompanies([]);
    setPeriods([]);
    setShinkoukiData([]);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [c, p, s] = await Promise.all([
        fetchCompanies(),
        fetchFiscalPeriods(),
        fetchShinkouki(),
      ]);
      setCompanies(c);
      setPeriods(p);
      setShinkoukiData(s);
    } catch (err) {
      console.error("Forest data fetch error:", err);
    }
  }, []);

  /**
   * ログイン成功後に呼ぶ：セッション + forest_user を再取得し、
   * 権限確認後にゲートを解錠する。
   * 権限なしなら signOut + error を返す。
   */
  const refreshAuth = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = await getSession();
      if (!session) {
        setIsAuthenticated(false);
        setHasPermission(false);
        setIsUnlocked(false);
        setUserEmail(null);
        setForestUser(null);
        return { success: false };
      }

      const fu = await fetchForestUser(session.user.id);
      if (!fu) {
        // 権限なし → Supabase Auth 終了、ゲートロック
        await signOutForest();
        clearForestUnlock();
        setIsAuthenticated(false);
        setHasPermission(false);
        setIsUnlocked(false);
        setUserEmail(null);
        setForestUser(null);
        return { success: false, error: "社員番号またはパスワードが正しくありません" };
      }

      // 権限あり → 状態更新
      setIsAuthenticated(true);
      setUserEmail(session.user.email ?? null);
      setHasPermission(true);
      setForestUser(fu);
      setIsUnlocked(isForestUnlocked());
      return { success: true };
    } catch (err) {
      console.error("[forest] Refresh auth error:", err);
      return { success: false, error: "認証情報の取得に失敗しました" };
    }
  }, []);

  // --- Effects ---

  // 初期化：認証状態 + 権限チェック
  useEffect(() => {
    (async () => {
      try {
        await refreshAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAuth]);

  // データ取得（ゲート通過後）
  useEffect(() => {
    if (isUnlocked) {
      refreshData();
      writeAuditLog("view_dashboard");
    }
  }, [isUnlocked, refreshData]);

  // 2時間セッションタイマー
  useEffect(() => {
    if (!isUnlocked) return;
    const cleanup = startSessionTimer(() => {
      lockAndLogoutFn("timeout");
    });
    return cleanup;
  }, [isUnlocked, lockAndLogoutFn]);

  const value = useMemo<ForestState>(
    () => ({
      loading,
      isAuthenticated,
      hasPermission,
      isUnlocked,
      userEmail,
      forestUser,
      companies,
      periods,
      shinkouki: shinkoukiData,
      unlock,
      lockAndLogout: lockAndLogoutFn,
      refreshData,
      refreshAuth,
    }),
    [
      loading, isAuthenticated, hasPermission, isUnlocked,
      userEmail, forestUser, companies, periods, shinkoukiData,
      unlock, lockAndLogoutFn, refreshData, refreshAuth,
    ],
  );

  return (
    <ForestStateContext.Provider value={value}>
      {children}
    </ForestStateContext.Provider>
  );
}
