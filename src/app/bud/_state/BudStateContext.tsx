"use client";

/**
 * Garden-Bud shared app state.
 *
 * Authentication is split into:
 * 1. Garden/Supabase Auth session
 * 2. Bud permission, via root_employees + bud_users
 * 3. Bud two-hour unlock, stored by unified auth as `bud:unlockedAt`
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
import {
  clearBudUnlock,
  getSession,
  markBudUnlocked,
  signOutBud as signOutBudLib,
} from "../_lib/auth";
import { fetchBudSessionUser } from "../_lib/queries";

const isBudDevBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "1";

const DEV_SESSION_USER: BudSessionUser = {
  employee_id: "dev-bypass",
  employee_number: "dev",
  name: "Bud Dev Bypass",
  garden_role: "super_admin",
  user_id: "dev-bypass",
  bud_role: "admin",
  effective_bud_role: "admin",
};

type BudStateValue = {
  /** Authentication check is running. */
  loading: boolean;
  /** Garden/Supabase Auth session exists. */
  isAuthenticated: boolean;
  /** The authenticated Garden user may use Bud. */
  hasPermission: boolean;
  /** Bud two-hour unlock state. */
  isUnlocked: boolean;
  /** Authenticated user's Bud access info. */
  sessionUser: BudSessionUser | null;
  gardenRole: GardenRole | null;
  budRole: BudRole | null;
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasGardenRoleAtLeast: (baseline: GardenRole) => boolean;
  hasBudRoleAtLeast: (baseline: BudRole) => boolean;
};

const BudStateContext = createContext<BudStateValue | null>(null);

export function BudStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sessionUser, setSessionUser] = useState<BudSessionUser | null>(null);

  const refreshAuth = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setLoading(true);
    try {
      if (isBudDevBypass) {
        setIsAuthenticated(true);
        setHasPermission(true);
        setIsUnlocked(true);
        setSessionUser(DEV_SESSION_USER);
        return { success: true };
      }

      const session = await getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setHasPermission(false);
        setIsUnlocked(false);
        setSessionUser(null);
        return { success: false, error: "セッションがありません" };
      }

      const user = await fetchBudSessionUser(session.user.id);
      if (!user) {
        clearBudUnlock();
        setIsAuthenticated(true);
        setHasPermission(false);
        setIsUnlocked(false);
        setSessionUser(null);
        return { success: false, error: "Bud利用権限がありません" };
      }

      // 有効な Garden セッション＋Bud権限があれば解錠扱いにする（再開セッション/2h経過でも
      // BudGate に弾かれないよう、解錠フラグをここで確実に立てる）。
      markBudUnlocked();
      setIsAuthenticated(true);
      setHasPermission(true);
      setIsUnlocked(true);
      setSessionUser(user);
      return { success: true };
    } catch (e) {
      console.error("[bud] refreshAuth", e);
      setIsAuthenticated(false);
      setHasPermission(false);
      setIsUnlocked(false);
      setSessionUser(null);
      return { success: false, error: "認証エラーが発生しました" };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutBudLib();
    setIsAuthenticated(false);
    setHasPermission(false);
    setIsUnlocked(false);
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

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const value = useMemo<BudStateValue>(
    () => ({
      loading,
      isAuthenticated,
      hasPermission,
      isUnlocked,
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
      hasPermission,
      isUnlocked,
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
