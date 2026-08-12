/**
 * Garden-Tree — 認証ヘルパー（社員番号 + パスワード方式）
 *
 * - signInTree(empId, password): 社員番号+パスワードでログイン（認証のみ）
 *   内部で `emp{4桁}@garden.internal` 擬似メールに変換し
 *   Supabase Auth.signInWithPassword に渡す。
 *   Tree 権限（garden_role）チェックは呼び出し側（TreeStateContext.refreshAuth）で行う。
 * - signOutTree(): Tree セッション終了
 * - isTreeUnlocked(): セッション有効性チェック（8時間）
 * - touchTreeSession(): 操作ごとに最終操作時刻を更新
 *
 * 設計方針:
 *   Forest モジュールの _lib/auth.ts と同じパターンで実装。
 *   認証と権限チェックを分離することで、signInWithPassword 直後の
 *   JWT 反映タイミング問題を回避する。
 *
 * 関連ドキュメント:
 *   docs/superpowers/specs/2026-04-21-tree-supabase-integration-design.md
 *   親 CLAUDE.md §4（認証ポリシー）
 */

import {
  clearAuthSession,
  isAuthSessionUnlocked,
  touchAuthSession,
  unlockAuthSession,
} from "../../_lib/auth-unified";
import { supabase } from "./supabase";

/**
 * 社員番号 → 擬似メールアドレス変換
 * 例: "8" または "0008" → "emp0008@garden.internal"
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

/**
 * 社員番号 + パスワードで Supabase Auth にサインイン（認証のみ）
 *
 * 注意: このメソッドは Tree 権限（root_employees の garden_role）を確認しない。
 *       呼び出し側（TreeStateContext.refreshAuth）で fetchTreeUser を実行して
 *       ロールを取得・検証すること。
 */
export async function signInTree(
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

  unlockAuthSession("tree");
  return { success: true, userId: data.user.id };
}

/** Tree セッション + Supabase Auth セッションを終了 */
export async function signOutTree(): Promise<void> {
  clearTreeUnlock();
  await supabase.auth.signOut();
}

/** Tree セッションが有効か（統一認証の2時間ゲート内か） */
export function isTreeUnlocked(): boolean {
  return isAuthSessionUnlocked("tree");
}

/** 操作ごとにアクティビティ時刻を更新 */
export function touchTreeSession(): void {
  touchAuthSession("tree");
}

/**
 * Mark Tree as unlocked after Garden auth and Tree permission are verified.
 * This restores the local gate for resumed cookie sessions.
 */
export function markTreeUnlocked(): void {
  unlockAuthSession("tree");
}

/** Tree セッションを強制クリア（権限チェック失敗時など） */
export function clearTreeUnlock(): void {
  clearAuthSession("tree");
}

/** 現在の Supabase Auth セッション取得 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 現在の Supabase Auth ユーザー取得 */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
