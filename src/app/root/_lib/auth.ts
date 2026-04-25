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

import { supabase } from "./supabase";
import { SESSION_TIMEOUT_MS } from "./session-timer";

const ROOT_UNLOCKED_KEY = "rootUnlockedAt";
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

  if (typeof window !== "undefined") {
    sessionStorage.setItem(ROOT_UNLOCKED_KEY, Date.now().toString());
  }
  return { success: true, userId: data.user.id };
}

export async function signOutRoot(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ROOT_UNLOCKED_KEY);
  }
  await supabase.auth.signOut();
}

export function isRootUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(ROOT_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  return Date.now() - unlockedAt < SESSION_TIMEOUT_MS;
}

export function touchRootSession(): void {
  if (typeof window === "undefined") return;
  if (isRootUnlocked()) {
    sessionStorage.setItem(ROOT_UNLOCKED_KEY, Date.now().toString());
  }
}

/** 最終操作からの経過ミリ秒 (タイマー警告用) */
export function getSessionElapsedMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(ROOT_UNLOCKED_KEY);
  if (!raw) return 0;
  return Date.now() - parseInt(raw, 10);
}

export function clearRootUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ROOT_UNLOCKED_KEY);
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
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
