/**
 * Garden-Tree — DBクエリ関数
 *
 * - fetchTreeUser(userId): 認証済みユーザーの root_employees 行を取得。
 *   garden_role / 氏名 / 誕生日 / company_id 等を含む。
 *   RLS により本人は必ず自分の行にアクセス可能（root_employees_select_own）。
 * - insertCall(params): 通話記録を soil_call_history に保存（Phase B）。
 * - updateBirthday: 誕生日を root_employees に保存（初回ログイン時入力など）。
 *
 * 将来追加予定:
 *   - fetchTodayStats: 当日のKPI統計（Phase C）
 */

import { supabase } from "./supabase";
import type { GardenRole } from "../../root/_constants/types";

/** Tree で必要な従業員情報 */
export type TreeUser = {
  employee_id: string;
  employee_number: string;
  name: string;
  name_kana: string;
  email: string;
  garden_role: GardenRole;
  birthday: string | null;
  company_id: string;
  employment_type: string;
  is_active: boolean;
  user_id: string;
};

/**
 * 認証済みユーザーの root_employees 行を取得
 *
 * @param userId  Supabase Auth の user.id（auth.uid() と同値）
 * @returns       TreeUser（存在し is_active=true のとき）、それ以外は null
 *
 * RLS:
 *   - 本人の行は `root_employees_select_own` ポリシーで取得可能
 *   - manager+ は `root_employees_select_manager` で全員取得可能
 */
export async function fetchTreeUser(userId: string): Promise<TreeUser | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select(
      [
        "employee_id",
        "employee_number",
        "name",
        "name_kana",
        "email",
        "garden_role",
        "birthday",
        "company_id",
        "employment_type",
        "is_active",
        "user_id",
      ].join(","),
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[fetchTreeUser] error:", error);
    return null;
  }
  return (data ?? null) as TreeUser | null;
}

// ============================================================
// soil_call_history: 通話記録
// ============================================================

/** soil_call_history.call_mode が取りうる値 */
export type CallMode =
  | "sprout"       // Sprout(トス) 架電
  | "branch"       // Branch(クローザー) 架電
  | "confirm_pre"  // 前確モード
  | "confirm_post" // 後確モード
  | "follow";      // フォローコール

/** insertCall の引数 */
export type InsertCallParams = {
  /** 架電した従業員の employee_id（通常は自分の treeUser.employee_id） */
  employee_id: string;
  /** 通話開始時刻 */
  started_at: Date;
  /** 通話終了時刻 */
  ended_at: Date;
  /** 結果コード（トス / 受注 / 担不 / 見込 A 等） */
  result_code: string;
  /** 架電モード */
  call_mode: CallMode;
  /** トス先クローザーの employee_id（Sprout でトス成功時のみ） */
  toss_to_id?: string;
  /** リスト名 */
  list_name?: string;
  /** 顧客名 */
  customer_name?: string;
  /** 電話番号 */
  phone?: string;
  /** 続柄（主人/奥様/男性/女性/息子/老女/老男） */
  relationship?: string;
  /** 見込み/コインの次回連絡予定時刻 */
  next_contact_at?: Date;
  /** NG その他の理由 */
  ng_reason?: string;
  /** 架電メモ */
  memo?: string;
};

/**
 * 通話記録を soil_call_history に INSERT する
 *
 * RLS により `employee_id = 自分の employee_id` 以外は INSERT 不可。
 * 保存失敗してもUI継続できるよう、呼び出し側でエラーハンドリングすること。
 *
 * @returns 成功時は { success: true, callId: uuid }、失敗時は { success: false, error }
 */
export async function insertCall(
  params: InsertCallParams,
): Promise<{ success: boolean; callId?: string; error?: string }> {
  const row: Record<string, unknown> = {
    employee_id: params.employee_id,
    started_at: params.started_at.toISOString(),
    ended_at: params.ended_at.toISOString(),
    result_code: params.result_code,
    call_mode: params.call_mode,
  };

  if (params.toss_to_id)      row.toss_to_id      = params.toss_to_id;
  if (params.list_name)        row.list_name        = params.list_name;
  if (params.customer_name)    row.customer_name    = params.customer_name;
  if (params.phone)            row.phone            = params.phone;
  if (params.relationship)     row.relationship     = params.relationship;
  if (params.next_contact_at)  row.next_contact_at  = params.next_contact_at.toISOString();
  if (params.ng_reason)        row.ng_reason        = params.ng_reason;
  if (params.memo)             row.memo             = params.memo;

  const { data, error } = await supabase
    .from("soil_call_history")
    .insert(row)
    .select("call_id")
    .single();

  if (error) {
    console.error("[insertCall] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true, callId: (data as { call_id: string }).call_id };
}

/**
 * 誕生日を保存する（初回ログイン時の本人入力・後から変更可）
 *
 * @param userId    Supabase Auth の user.id
 * @param birthday  YYYY-MM-DD 形式
 * @returns         成否
 *
 * 注: birthday の保存に加えて Supabase Auth のパスワードも MMDD に更新する設計だが、
 *     パスワード変更には service_role_key が必要なためサーバー側エンドポイント経由で実行予定（Phase B）。
 *     Phase A の時点では root_employees.birthday の保存のみ。
 */
export async function updateBirthday(
  userId: string,
  birthday: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("root_employees")
    .update({ birthday })
    .eq("user_id", userId);

  if (error) {
    console.error("[updateBirthday] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
