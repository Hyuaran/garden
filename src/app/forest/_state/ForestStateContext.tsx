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
import { getSession, getUser, isForestUnlocked, signOutForest } from "../_lib/auth";
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
  lockAndLogout: (reason: "manual" | "timeout") => void;
  refreshData: () => Promise<void>;
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

  const lockAndLogoutFn = useCallback((reason: "manual" | "timeout") => {
    const action = reason === "manual" ? "logout_manual" : "logout_timeout";
    writeAuditLog(action);
    signOutForest();
    setIsUnlocked(false);
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

  // --- Effects ---

  // 初期化：認証状態 + 権限チェック
  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (!session) {
          setLoading(false);
          return;
        }
        setIsAuthenticated(true);
        setUserEmail(session.user.email ?? null);

        const fu = await fetchForestUser(session.user.id);
        if (fu) {
          setHasPermission(true);
          setForestUser(fu);
          setIsUnlocked(isForestUnlocked());
        }
      } catch (err) {
        console.error("[forest] Initialization error:", err);
        // エラー時は未認証扱い
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    }),
    [
      loading, isAuthenticated, hasPermission, isUnlocked,
      userEmail, forestUser, companies, periods, shinkoukiData,
      unlock, lockAndLogoutFn, refreshData,
    ],
  );

  return (
    <ForestStateContext.Provider value={value}>
      {children}
    </ForestStateContext.Provider>
  );
}
