/**
 * Garden-Root — 認証ヘルパー (社員番号 + パスワード)
 *
 * - signInRoot(empId, password): Supabase Auth にサインイン (認証のみ)
 *   権限 (garden_role) の検証は RootStateContext.refreshAuth で実施
 * - signOutRoot(): セッション終了 + returnTo 保存
 * - isRootUnlocked(): セッション有効か (最終操作から指定時間内か)
 * - touchRootSession(): 最終操作時刻を更新
 * - saveReturnTo / popReturnTo: ログアウト時に開いていた URL を保存・復元
 *
 * 設計方針: Tree Phase A (src/app/tree/_lib/auth.ts) を踏襲。
 */

import {
  clearAuthSession,
  isAuthSessionUnlocked,
  touchAuthSession,
  unlockAuthSession,
} from "@/app/_lib/auth-unified";
import { supabase } from "./supabase";
import { SESSION_TIMEOUT_MS } from "./session-timer";

const ROOT_UNLOCKED_KEY = "root:unlockedAt";
const ROOT_RETURN_TO_KEY = "rootReturnTo";

export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

export async function signInRoot(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }

  const email = toSyntheticEmail(empId);
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

  unlockAuthSession("root");
  return { success: true, userId: data.user.id };
}

export async function signOutRoot(): Promise<void> {
  clearRootUnlock();
  await supabase.auth.signOut();
}

export function isRootUnlocked(): boolean {
  return isAuthSessionUnlocked("root") && getSessionElapsedMs() < SESSION_TIMEOUT_MS;
}

export function touchRootSession(): void {
  if (isRootUnlocked()) {
    touchAuthSession("root");
  }
}

/**
 * Mark Root as unlocked for the current authenticated session.
 * Called after refreshAuth verifies both Garden auth and Root view permission
 * so a resumed session is not immediately timed out by Root's local timer.
 */
export function markRootUnlocked(): void {
  unlockAuthSession("root");
}

/** 最終操作からの経過ミリ秒 (タイマー警告用) */
export function getSessionElapsedMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(ROOT_UNLOCKED_KEY);
  if (!raw) return 0;
  const unlockedAt = parseInt(raw, 10);
  if (!Number.isFinite(unlockedAt)) return 0;
  return Date.now() - unlockedAt;
}

export function clearRootUnlock(): void {
  clearAuthSession("root");
}

/** ログアウト時に開いていた URL を保存 (再ログイン後の復帰用) */
export function saveReturnTo(path: string): void {
  if (typeof window === "undefined") return;
  if (path === "/root/login") return;
  sessionStorage.setItem(ROOT_RETURN_TO_KEY, path);
}

/** 復帰 URL を取り出して削除 (なければ /root) */
export function popReturnTo(): string {
  if (typeof window === "undefined") return "/root";
  const path = sessionStorage.getItem(ROOT_RETURN_TO_KEY);
  sessionStorage.removeItem(ROOT_RETURN_TO_KEY);
  return path ?? "/root";
}

export async function getSession() {
  await supabase.auth.getUser();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
