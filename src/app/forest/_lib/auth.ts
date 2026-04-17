/**
 * Garden-Forest 認証ヘルパー（社員番号+パスワード方式）
 *
 * - signInForest(empId, password): 社員番号+パスワードでログイン
 *   内部的には `emp{社員番号}@garden.internal` という擬似メールを生成して
 *   Supabase Auth.signInWithPassword に渡す。認証成功後 forest_users 参照で
 *   Forest アクセス権限の有無も確認する。
 * - signOutForest: Forest セッション終了
 * - isForestUnlocked: 2h ゲート有効性チェック
 * - touchForestSession: 操作ごとに最終操作時刻を更新
 *
 * 設計ドキュメント: docs/auth/login-implementation-guide.md
 */

import { supabase } from "./supabase";

const FOREST_UNLOCKED_KEY = "forestUnlockedAt";

/**
 * 社員番号 → 擬似メールアドレス変換
 * 例: "8" または "0008" → "emp0008@garden.internal"
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

/**
 * 社員番号+パスワードで Forest にログイン
 *
 * 手順:
 *  1. 擬似メール生成
 *  2. Supabase Auth.signInWithPassword で認証
 *  3. 成功なら forest_users を検索して権限確認
 *  4. 権限ありなら sessionStorage に unlock 時刻を記録
 *  5. 権限なしなら即時 signOut してエラー返却
 */
export async function signInForest(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }

  const email = toSyntheticEmail(empId);

  // 1. Supabase Auth 認証
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

  // 2. forest_users で権限確認
  const { data: fu, error: fuErr } = await supabase
    .from("forest_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (fuErr || !fu) {
    // 権限なし → Supabase Auth セッションも終了
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Forest へのアクセス権限がありません",
    };
  }

  // 3. ゲート通過時刻を sessionStorage に記録
  sessionStorage.setItem(FOREST_UNLOCKED_KEY, Date.now().toString());
  return { success: true, userId: data.user.id };
}

/** Forest セッション + Supabase Auth セッションを終了 */
export async function signOutForest(): Promise<void> {
  sessionStorage.removeItem(FOREST_UNLOCKED_KEY);
  await supabase.auth.signOut();
}

/** Forest ゲートが有効か（2時間以内にパスワード入力済みか） */
export function isForestUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(FOREST_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return Date.now() - unlockedAt < TWO_HOURS_MS;
}

/** Forest ゲートのアクティビティ更新（操作があるたびに呼ぶ） */
export function touchForestSession(): void {
  if (typeof window === "undefined") return;
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
