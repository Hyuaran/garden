/**
 * Garden-Forest 認証ヘルパー
 *
 * - signInForest: パスワード再検証（Forest ゲート）
 * - signOutForest: Forest セッション終了（Garden Auth は維持）
 * - getSession: 現在の Garden Auth セッション取得
 */

import { supabase } from "./supabase";

const FOREST_UNLOCKED_KEY = "forestUnlockedAt";

/** Forest パスワードゲートを通過（Garden パスワードで再検証） */
export async function signInForest(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  // ゲート通過時刻を sessionStorage に記録
  sessionStorage.setItem(FOREST_UNLOCKED_KEY, Date.now().toString());
  return { success: true };
}

/** Forest セッションのみ終了（Garden Auth セッションは維持） */
export function signOutForest(): void {
  sessionStorage.removeItem(FOREST_UNLOCKED_KEY);
}

/** Forest ゲートが有効か（2時間以内にパスワード入力済みか） */
export function isForestUnlocked(): boolean {
  const raw = sessionStorage.getItem(FOREST_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return Date.now() - unlockedAt < TWO_HOURS_MS;
}

/** Forest ゲートのアクティビティ更新（操作があるたびに呼ぶ） */
export function touchForestSession(): void {
  if (isForestUnlocked()) {
    sessionStorage.setItem(FOREST_UNLOCKED_KEY, Date.now().toString());
  }
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
