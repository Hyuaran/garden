/**
 * Garden-Tree — DBクエリ関数
 *
 * - fetchTreeUser(userId): 認証済みユーザーの root_employees 行を取得。
 *   garden_role / 氏名 / 誕生日 / company_id 等を含む。
 *   RLS により本人は必ず自分の行にアクセス可能（root_employees_select_own）。
 *
 * 将来追加予定:
 *   - fetchTodayStats: 当日のKPI統計（Phase C）
 *   - insertCall: 通話記録保存（Phase B、soil_call_history）
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
