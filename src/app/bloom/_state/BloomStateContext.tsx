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
 * 現在は認証スケルトンのみ。
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

export function BloomStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [bloomUser, setBloomUser] = useState<BloomUser | null>(null);

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
