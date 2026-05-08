"use client";

/**
 * Garden-Bud — アプリ全体の共有状態
 *
 * レイヤー:
 *   1. Supabase Auth（認証情報）
 *   2. root_employees.garden_role + bud_users.bud_role（二段階権限）
 *   3. BudStateContext（Bud 内の共有状態）
 *
 * 各画面・サイドバーは useBudState() で参照する。
 * layout.tsx で最上位に配置する。
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
  isRoleAtLeast,
  type GardenRole,
} from "../../root/_constants/types";
import { isBudRoleAtLeast } from "../_constants/roles";
import type { BudRole, BudSessionUser } from "../_constants/types";
import { getSession, signOutBud as signOutBudLib } from "../_lib/auth";
import { fetchBudSessionUser } from "../_lib/queries";

type BudStateValue = {
  /** 認証確認中（初回レンダー〜refreshAuth 完了まで true） */
  loading: boolean;
  /** Supabase Auth セッション + Bud アクセス権 OK */
  isAuthenticated: boolean;
  /** 認証済ユーザーの Bud アクセス情報 */
  sessionUser: BudSessionUser | null;
  /** ショートカット: garden_role */
  gardenRole: GardenRole | null;
  /** ショートカット: 実効 bud_role（明示登録なければ admin 扱い） */
  budRole: BudRole | null;
  /** ログイン後/セッション復帰時の認証再確認 */
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
  /** ログアウト + セッションクリア */
  signOut: () => Promise<void>;
  /** garden_role 階層比較（Root の isRoleAtLeast ラッパー） */
  hasGardenRoleAtLeast: (baseline: GardenRole) => boolean;
  /** bud_role 階層比較 */
  hasBudRoleAtLeast: (baseline: BudRole) => boolean;
};

const BudStateContext = createContext<BudStateValue | null>(null);

export function BudStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState<BudSessionUser | null>(null);

  const refreshAuth = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setSessionUser(null);
        return { success: false, error: "セッションがありません" };
      }
      const user = await fetchBudSessionUser(session.user.id);
      if (!user) {
        setIsAuthenticated(false);
        setSessionUser(null);
        return { success: false, error: "Bud利用権限がありません" };
      }
      setSessionUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (e) {
      console.error("[refreshAuth]", e);
      setIsAuthenticated(false);
      setSessionUser(null);
      return { success: false, error: "認証エラーが発生しました" };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutBudLib();
    setIsAuthenticated(false);
    setSessionUser(null);
  }, []);

  const hasGardenRoleAtLeast = useCallback(
    (baseline: GardenRole) => {
      const gr = sessionUser?.garden_role;
      if (!gr) return false;
      return isRoleAtLeast(gr, baseline);
    },
    [sessionUser],
  );

  const hasBudRoleAtLeast = useCallback(
    (baseline: BudRole) => {
      return isBudRoleAtLeast(sessionUser?.effective_bud_role, baseline);
    },
    [sessionUser],
  );

  // 初回マウント時に認証確認
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const value = useMemo<BudStateValue>(
    () => ({
      loading,
      isAuthenticated,
      sessionUser,
      gardenRole: sessionUser?.garden_role ?? null,
      budRole: sessionUser?.effective_bud_role ?? null,
      refreshAuth,
      signOut,
      hasGardenRoleAtLeast,
      hasBudRoleAtLeast,
    }),
    [
      loading,
      isAuthenticated,
      sessionUser,
      refreshAuth,
      signOut,
      hasGardenRoleAtLeast,
      hasBudRoleAtLeast,
    ],
  );

  return (
    <BudStateContext.Provider value={value}>
      {children}
    </BudStateContext.Provider>
  );
}

export function useBudState(): BudStateValue {
  const ctx = useContext(BudStateContext);
  if (!ctx) {
    throw new Error("useBudState must be used within BudStateProvider");
  }
  return ctx;
}
