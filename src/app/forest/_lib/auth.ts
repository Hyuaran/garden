/**
 * Garden-Forest 認証ヘルパー（社員番号+パスワード方式）
 *
 * - signInForest(empId, password): 社員番号+パスワードでログイン（認証のみ）
 *   内部的には `emp{社員番号}@garden.internal` という擬似メールを生成して
 *   Supabase Auth.signInWithPassword に渡す。
 *   Forest 権限チェックは呼び出し側（ForestStateContext.refreshAuth）で行う。
 *   認証と権限チェックを分離することで、RLS で auth.uid() がまだ反映されない
 *   タイミング問題を回避する。
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
 * 社員番号+パスワードで Supabase Auth にサインイン（認証のみ）
 *
 * 注意: このメソッドは Forest 権限（forest_users への登録有無）を確認しない。
 *       呼び出し側（ForestGate → refreshAuth）で権限チェックを行うこと。
 *
 * 理由: signInWithPassword 直後に forest_users を SELECT すると、
 *       Supabase JS クライアントが JWT を反映しきっていないタイミングに
 *       当たり RLS が auth.uid() = NULL と評価してブロックするケースがある。
 */
export async function signInForest(
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

  // ゲート通過時刻を sessionStorage に記録（refreshAuth の isForestUnlocked 用）
  sessionStorage.setItem(FOREST_UNLOCKED_KEY, Date.now().toString());
  return { success: true, userId: data.user.id };
}

/** Forest セッション + Supabase Auth セッションを終了 */
export async function signOutForest(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(FOREST_UNLOCKED_KEY);
  }
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

/** Forest ゲート強制ロック（権限チェック失敗時など） */
export function clearForestUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(FOREST_UNLOCKED_KEY);
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
