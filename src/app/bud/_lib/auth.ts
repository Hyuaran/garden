/**
 * Garden-Bud — 認証ヘルパー
 *
 * - signInBud(empId, password): 社員番号+擬似メールで認証
 * - signOutBud(): Bud セッション終了
 * - isBudUnlocked(): セッション有効性チェック（経理系は厳しめに2時間）
 * - touchBudSession(): 操作ごとに最終操作時刻を更新
 *
 * Tree の auth.ts と同じパターン。セッション長は経理アプリなので
 * Tree の 8時間より短く 2時間にする。
 */

import { supabase } from "./supabase";

const BUD_UNLOCKED_KEY = "budUnlockedAt";

/** Bud セッションの有効期間（経理系なので短め） */
const BUD_SESSION_HOURS = 2;

/**
 * 社員番号 → 擬似メール変換
 * 例: "8" または "0008" → "emp0008@garden.internal"
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

/**
 * 社員番号 + パスワードで Supabase Auth にサインイン（認証のみ）
 *
 * 権限チェック（garden_role と bud_users の確認）は
 * BudStateContext.refreshAuth で行う。
 */
export async function signInBud(
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
    sessionStorage.setItem(BUD_UNLOCKED_KEY, Date.now().toString());
  }
  return { success: true, userId: data.user.id };
}

/** Bud セッション + Supabase Auth セッションを終了 */
export async function signOutBud(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(BUD_UNLOCKED_KEY);
  }
  await supabase.auth.signOut();
}

/** Bud セッションが有効か（最終操作から 2時間以内か） */
export function isBudUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(BUD_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  const TIMEOUT_MS = BUD_SESSION_HOURS * 60 * 60 * 1000;
  return Date.now() - unlockedAt < TIMEOUT_MS;
}

/** 操作ごとにアクティビティ時刻を更新 */
export function touchBudSession(): void {
  if (typeof window === "undefined") return;
  if (isBudUnlocked()) {
    sessionStorage.setItem(BUD_UNLOCKED_KEY, Date.now().toString());
  }
}

/** Bud セッションを強制クリア（権限チェック失敗時など） */
export function clearBudUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BUD_UNLOCKED_KEY);
}

/** 現在の Supabase Auth セッション取得 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
