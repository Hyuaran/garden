"use client";

/**
 * Garden-Bloom 全体の共有状態
 *
 * - Garden Auth セッション
 * - Bloom 権限（root_employees.garden_role）
 * - Bloom ゲート状態（パスワード再入力済みか）
 * - 2時間セッションタイマー
 *
 * データ（worker-status / daily-log / roadmap 等）の取得は T4 以降で追加する。
 *
 * dispatch main- No.79 (2026-05-07):
 *   dev mode（NODE_ENV === "development" or NEXT_PUBLIC_BLOOM_DEV_MOCK="1"）で
 *   東海林さんダミーユーザーを即時返却。Workboard / Roadmap 等が認証 pending で
 *   loading 滞留する問題を解消。BloomGate の dev バイパスと整合（memory
 *   project_bloom_auth_independence.md 参照）。
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

import {
  clearBloomUnlock,
  fetchBloomUser,
  getSession,
  hasAccess,
  isBloomUnlocked,
  signOutBloom,
  type BloomUser,
  type GardenRole,
} from "../_lib/auth";
import { startSessionTimer } from "../_lib/session-timer";

type BloomState = {
  /** ローディング中 */
  loading: boolean;
  /** Garden Auth 済み */
  isAuthenticated: boolean;
  /** root_employees に登録済み（garden_role 取得済み） */
  hasPermission: boolean;
  /** Bloom パスワードゲート通過済み（2h 有効） */
  isUnlocked: boolean;
  /** 現在のユーザー情報 */
  userEmail: string | null;
  bloomUser: BloomUser | null;
  /** 権限判定ショートカット */
  role: GardenRole | null;
  canRead: (min: GardenRole) => boolean;
  /** 操作 */
  unlock: () => void;
  lockAndLogout: (reason: "manual" | "timeout") => Promise<void>;
  /**
   * ログイン成功後に呼ぶ：セッション + bloom_user を再取得してゲートを解錠。
   * root_employees 未登録（user_id 未紐付け）の場合は signOut して error を返す。
   */
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
};

const BloomStateContext = createContext<BloomState | null>(null);

export function useBloomState(): BloomState {
  const ctx = useContext(BloomStateContext);
  if (!ctx) throw new Error("useBloomState must be used inside BloomStateProvider");
  return ctx;
}

// dispatch main- No.79: dev mode で即時ダミーユーザー注入 (BloomGate dev バイパスと整合)
const DEV_MOCK_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_BLOOM_DEV_MOCK === "1";

const DEV_MOCK_USER: BloomUser = {
  user_id: "dev-shoji",
  employee_id: "EMP-DEV",
  employee_number: "0001",
  name: "東海林 美琴",
  garden_role: "super_admin",
  birthday: null,
};

const DEV_MOCK_EMAIL = "shoji-dev@hyuaran.com";

export function BloomStateProvider({ children }: { children: ReactNode }) {
  // dev mock 有効時は最初から認証済み状態で起動 (loading=false、bloomUser 設定済み)
  const [loading, setLoading] = useState(!DEV_MOCK_ENABLED);
  const [isAuthenticated, setIsAuthenticated] = useState(DEV_MOCK_ENABLED);
  const [hasPermission, setHasPermission] = useState(DEV_MOCK_ENABLED);
  const [isUnlocked, setIsUnlocked] = useState(DEV_MOCK_ENABLED);
  const [userEmail, setUserEmail] = useState<string | null>(
    DEV_MOCK_ENABLED ? DEV_MOCK_EMAIL : null,
  );
  const [bloomUser, setBloomUser] = useState<BloomUser | null>(
    DEV_MOCK_ENABLED ? DEV_MOCK_USER : null,
  );

  const unlock = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  const lockAndLogoutFn = useCallback(async (_reason: "manual" | "timeout") => {
    await signOutBloom();
    setIsAuthenticated(false);
    setHasPermission(false);
    setIsUnlocked(false);
    setUserEmail(null);
    setBloomUser(null);
  }, []);

  const refreshAuth = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = await getSession();
      if (!session) {
        setIsAuthenticated(false);
        setHasPermission(false);
        setIsUnlocked(false);
        setUserEmail(null);
        setBloomUser(null);
        return { success: false };
      }

      const bu = await fetchBloomUser(session.user.id);
      if (!bu) {
        await signOutBloom();
        clearBloomUnlock();
        setIsAuthenticated(false);
        setHasPermission(false);
        setIsUnlocked(false);
        setUserEmail(null);
        setBloomUser(null);
        return { success: false, error: "Bloom 権限が確認できません" };
      }

      setIsAuthenticated(true);
      setUserEmail(session.user.email ?? null);
      setHasPermission(true);
      setBloomUser(bu);
      setIsUnlocked(isBloomUnlocked());
      return { success: true };
    } catch (err) {
      console.error("[bloom] Refresh auth error:", err);
      return { success: false, error: "認証情報の取得に失敗しました" };
    }
  }, []);

  useEffect(() => {
    // dev mock 有効時は refreshAuth をスキップ (Supabase auth 接続不要、即動作)
    if (DEV_MOCK_ENABLED) {
      return;
    }
    (async () => {
      try {
        await refreshAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAuth]);

  useEffect(() => {
    if (!isUnlocked) return;
    const cleanup = startSessionTimer(() => {
      lockAndLogoutFn("timeout");
    });
    return cleanup;
  }, [isUnlocked, lockAndLogoutFn]);

  const canRead = useCallback(
    (min: GardenRole) => hasAccess(bloomUser?.garden_role ?? null, min),
    [bloomUser],
  );

  const value = useMemo<BloomState>(
    () => ({
      loading,
      isAuthenticated,
      hasPermission,
      isUnlocked,
      userEmail,
      bloomUser,
      role: bloomUser?.garden_role ?? null,
      canRead,
      unlock,
      lockAndLogout: lockAndLogoutFn,
      refreshAuth,
    }),
    [
      loading,
      isAuthenticated,
      hasPermission,
      isUnlocked,
      userEmail,
      bloomUser,
      canRead,
      unlock,
      lockAndLogoutFn,
      refreshAuth,
    ],
  );

  return (
    <BloomStateContext.Provider value={value}>
      {children}
    </BloomStateContext.Provider>
  );
}
