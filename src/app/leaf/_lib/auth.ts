/**
 * Garden-Leaf 関電業務委託 — 認証ヘルパー
 *
 * - signInLeaf(empId, password): 社員番号+パスワードでログイン
 * - signOutLeaf: セッション終了
 * - isLeafUnlocked: 5分ロック有効性チェック（操作があるたびにリセット）
 * - touchLeafSession: 操作ごとに最終操作時刻を更新（5分タイマーリセット）
 * - clearLeafUnlock: 強制ロック
 *
 * ロック設定: 5分固定（管理者のみ変更可、エンドユーザー変更不可）
 */

import { supabase } from "./supabase";

const LEAF_UNLOCKED_KEY = "leafUnlockedAt";
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5分

/**
 * 社員番号 → 擬似メールアドレス変換
 * 例: "8" または "0008" → "emp0008@garden.internal"
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

/**
 * 社員番号+パスワードで Supabase Auth にサインイン（認証のみ）
 */
export async function signInLeaf(
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
    sessionStorage.setItem(LEAF_UNLOCKED_KEY, Date.now().toString());
  }
  return { success: true, userId: data.user.id };
}

/** Leaf セッション + Supabase Auth セッションを終了 */
export async function signOutLeaf(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(LEAF_UNLOCKED_KEY);
  }
  await supabase.auth.signOut();
}

/** Leaf ゲートが有効か（最終操作から5分以内か） */
export function isLeafUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(LEAF_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  return Date.now() - unlockedAt < LOCK_TIMEOUT_MS;
}

/** 操作ごとに最終操作時刻を更新（5分タイマーリセット） */
export function touchLeafSession(): void {
  if (typeof window === "undefined") return;
  if (isLeafUnlocked()) {
    sessionStorage.setItem(LEAF_UNLOCKED_KEY, Date.now().toString());
  }
}

/** Leaf ゲート強制ロック */
export function clearLeafUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LEAF_UNLOCKED_KEY);
}

/** 現在の Garden Auth セッション取得 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 現在のユーザー取得 */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
