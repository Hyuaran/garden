"use client";

/**
 * Garden Series 統一認証ヘルパー（2026-05-11、Task 1）
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1
 *
 * 設計方針:
 *   - 既存 signInBloom / signInForest / signInTree / signInBud / signInRoot は削除しない
 *     （API 互換維持、本ファイルは Garden 全モジュール共通の新規エントリ）
 *   - useAuthUnified() Hook + AuthProvider Component を同一ファイルで export（IN-1）
 *   - sessionStorage キーは module 別 namespace で 6 モジュール分管理
 *   - sanitizeReturnTo は open redirect 対策（相対パスのみ許容）
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

import { supabase } from "../bloom/_lib/supabase";
import type { GardenRole } from "../root/_constants/types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export type ModuleKey = "bloom" | "forest" | "tree" | "bud" | "root" | "leaf";

const ALL_MODULES: ModuleKey[] = ["bloom", "forest", "tree", "bud", "root", "leaf"];

const SESSION_KEY = (m: ModuleKey) => `${m}:unlockedAt`;

// ============================================================
// Synthetic Email
// ============================================================

/**
 * 社員番号 → 擬似メールアドレス変換
 * 例: "8" または "0008" → "emp0008@garden.internal"
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

// ============================================================
// returnTo sanitize (open redirect 対策)
// ============================================================

/**
 * returnTo パラメータの sanitize
 *
 * 許容: `/foo`, `/foo/bar?x=1` などの **絶対パス（host を伴わない）**
 * 却下:
 *   - null / 空文字
 *   - `//evil.com` (protocol-relative)
 *   - `https://evil.com/...` (absolute URL)
 *   - 不正な URI encoded
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return null;
    if (decoded.startsWith("//")) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ============================================================
// signIn / signOut
// ============================================================

/**
 * 社員番号 + パスワードで Supabase Auth にサインイン（認証のみ）
 *
 * 成功時、6 モジュール全ての sessionStorage unlock を set する（cross-module SSO 効果）。
 * 各モジュールの権限チェックは AuthProvider 内の fetchRole + 各モジュール側 Gate で実施。
 */
export async function signInUnified(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }

  const email = toSyntheticEmail(empId.trim());

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      success: false,
      error: "社員番号またはパスワードが正しくありません",
    };
  }

  if (typeof window !== "undefined") {
    const now = Date.now().toString();
    ALL_MODULES.forEach((m) => {
      sessionStorage.setItem(SESSION_KEY(m), now);
    });
  }

  return { success: true, userId: data.user.id };
}

/**
 * Garden 全モジュールの session unlock をクリア + Supabase Auth セッションを終了
 */
export async function signOutUnified(): Promise<void> {
  if (typeof window !== "undefined") {
    ALL_MODULES.forEach((m) => {
      sessionStorage.removeItem(SESSION_KEY(m));
    });
  }
  await supabase.auth.signOut();
}

/**
 * 指定モジュールの session unlock が 2 時間以内に行われたか
 *
 * 引数省略時は "bloom" を既定（後方互換）。
 */
export function isAuthSessionUnlocked(moduleKey: ModuleKey = "bloom"): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(SESSION_KEY(moduleKey));
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  if (!Number.isFinite(unlockedAt)) return false;
  return Date.now() - unlockedAt < TWO_HOURS_MS;
}

/**
 * 指定モジュールの session unlock アクティビティ更新
 * （未 unlock の場合は何もしない、unlock 済のみ touch）
 */
export function touchAuthSession(moduleKey: ModuleKey): void {
  if (typeof window === "undefined") return;
  if (isAuthSessionUnlocked(moduleKey)) {
    sessionStorage.setItem(SESSION_KEY(moduleKey), Date.now().toString());
  }
}

/**
 * 指定モジュール（または全モジュール）の session unlock を強制クリア
 */
export function clearAuthSession(moduleKey?: ModuleKey): void {
  if (typeof window === "undefined") return;
  if (moduleKey) {
    sessionStorage.removeItem(SESSION_KEY(moduleKey));
  } else {
    ALL_MODULES.forEach((m) => {
      sessionStorage.removeItem(SESSION_KEY(m));
    });
  }
}

// ============================================================
// useAuthUnified Hook + AuthProvider (IN-1)
// ============================================================

type AuthState = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  role: GardenRole | null;
  employeeNumber: string | null;
  signIn: (
    empId: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; userId?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<GardenRole | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

  const fetchRole = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("root_employees")
      .select("garden_role, employee_number")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      // root_employees 未登録 / RLS 拒否時は role = null（各モジュール側 Gate で拒否される想定）
      setRole(null);
      setEmployeeNumber(null);
      return;
    }
    setRole((data?.garden_role as GardenRole | undefined) ?? null);
    setEmployeeNumber(data?.employee_number ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (uid) await fetchRole(uid);
      if (mounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        fetchRole(uid);
      } else {
        setRole(null);
        setEmployeeNumber(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signIn = useCallback(
    async (empId: string, password: string) => {
      const result = await signInUnified(empId, password);
      if (result.success && result.userId) {
        await fetchRole(result.userId);
        setUserId(result.userId);
      }
      return result;
    },
    [fetchRole],
  );

  const signOut = useCallback(async () => {
    await signOutUnified();
    setUserId(null);
    setRole(null);
    setEmployeeNumber(null);
  }, []);

  const value: AuthState = useMemo(
    () => ({
      loading,
      isAuthenticated: !!userId,
      userId,
      role,
      employeeNumber,
      signIn,
      signOut,
    }),
    [loading, userId, role, employeeNumber, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Garden 統一認証コンテキストを取得する Hook
 *
 * 利用条件: コンポーネント階層に <AuthProvider> が存在すること（root layout で wrap 済）
 */
export function useAuthUnified(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthUnified must be used within AuthProvider");
  }
  return ctx;
}
