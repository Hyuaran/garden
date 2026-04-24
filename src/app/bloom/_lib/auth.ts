/**
 * Garden-Bloom 認証ヘルパー（Forest 設計を流用）
 *
 * - signInBloom(empId, password): 社員番号+パスワードでログイン（認証のみ）
 *   擬似メール `emp{社員番号}@garden.internal` を生成して Supabase Auth へ。
 *   Bloom 権限は BloomStateContext.refreshAuth で root_employees を参照して判定。
 *
 * §8.2 判断: bloom_users テーブルは作らず root_employees.garden_role を直接参照。
 * 7段階ロール: toss / closer / cs / staff / manager / admin / super_admin
 *
 * §10.3 判5: Bloom 独自ログイン画面は当面作らず /forest/login へリダイレクト。
 *            本ファイルの signInBloom は将来 Bloom 独自ログインを導入した際の土台。
 *
 * 依存: scripts/root-auth-schema.sql（root_employees.user_id / garden_role 追加）
 */

import type { ModuleCode } from "../_types/module-progress";
import { supabase } from "./supabase";

const BLOOM_UNLOCKED_KEY = "bloomUnlockedAt";

export type GardenRole =
  | "toss"
  | "closer"
  | "cs"
  | "staff"
  | "manager"
  | "admin"
  | "super_admin";

export type BloomUser = {
  user_id: string;
  employee_id: string;
  employee_number: string;
  name: string;
  garden_role: GardenRole;
  birthday: string | null;
};

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
 * 注意: このメソッドは Bloom 権限（root_employees.garden_role の存在）を確認しない。
 *       呼び出し側（BloomStateContext.refreshAuth）で権限チェックを行うこと。
 */
export async function signInBloom(
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

  sessionStorage.setItem(BLOOM_UNLOCKED_KEY, Date.now().toString());
  return { success: true, userId: data.user.id };
}

/** Bloom セッション + Supabase Auth セッションを終了 */
export async function signOutBloom(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(BLOOM_UNLOCKED_KEY);
  }
  await supabase.auth.signOut();
}

/** Bloom ゲートが有効か（2時間以内にパスワード入力済みか） */
export function isBloomUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(BLOOM_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return Date.now() - unlockedAt < TWO_HOURS_MS;
}

/** Bloom ゲートのアクティビティ更新（操作があるたびに呼ぶ） */
export function touchBloomSession(): void {
  if (typeof window === "undefined") return;
  if (isBloomUnlocked()) {
    sessionStorage.setItem(BLOOM_UNLOCKED_KEY, Date.now().toString());
  }
}

/** Bloom ゲート強制ロック（権限チェック失敗時など） */
export function clearBloomUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BLOOM_UNLOCKED_KEY);
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

/**
 * root_employees から Bloom で必要な情報を取得（§8.2 準拠）
 *
 * - user_id 未紐付けの従業員（Auth 未連携）は存在しない想定
 * - garden_role が未設定の行は表示できない（RLS で弾く前提）
 *
 * 依存: feature/root-auth-ui の root-auth-schema.sql 適用済みであること
 */
export async function fetchBloomUser(userId: string): Promise<BloomUser | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select("user_id, employee_id, employee_number, name, garden_role, birthday")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[bloom] fetchBloomUser failed:", error.message);
    return null;
  }
  return (data as BloomUser | null) ?? null;
}

/** ロール階層ランク（UI 側の権限判定用） */
export function roleRank(role: GardenRole | null | undefined): number {
  switch (role) {
    case "toss": return 1;
    case "closer": return 2;
    case "cs": return 3;
    case "staff": return 4;
    case "manager": return 5;
    case "admin": return 6;
    case "super_admin": return 7;
    default: return 0;
  }
}

/** 指定ロール以上の権限を持つか（クライアント側チェック。RLS が主で本関数は UI 補助） */
export function hasAccess(role: GardenRole | null | undefined, min: GardenRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Bloom がターゲットとするモジュール一覧（将来のダッシュボード表示順） */
export const BLOOM_DEFAULT_MODULES: ModuleCode[] = [
  "bloom",
  "bud",
  "root",
  "forest",
  "tree",
  "leaf",
  "soil",
  "rill",
  "seed",
];
