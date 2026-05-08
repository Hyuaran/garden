/**
 * Garden-Bud — DBクエリ関数
 *
 * - fetchBudSessionUser(userId): 認証済みユーザーの Bud アクセス情報を取得
 *   root_employees と bud_users を JOIN し、BudSessionUser を返す。
 *
 * 二段階アクセス判定:
 *   1. garden_role が admin/super_admin → 自動許可（bud_users 不要）
 *   2. それ以外 → bud_users に is_active=true で登録されていればOK
 */

import { supabase } from "./supabase";
import type { GardenRole } from "../../root/_constants/types";
import type { BudRole, BudSessionUser } from "../_constants/types";
import { hasAutoAccess } from "../_constants/roles";

/**
 * Bud アクセス可能な認証済みユーザー情報を取得
 *
 * @param userId  Supabase Auth の user.id（auth.uid() と同値）
 * @returns       BudSessionUser（アクセス可能時）、null（アクセス不可）
 *
 * RLS:
 *   - root_employees_select_own で本人は自分の行を取得可能
 *   - bud_users_select_all で Bud アクセス者は bud_users を参照可能
 *     ※ ただし、最初の1回は bud_users がまだ見えない可能性があるため
 *       Garden admin/super_admin を優先で判定する設計
 */
export async function fetchBudSessionUser(
  userId: string,
): Promise<BudSessionUser | null> {
  // Step 1: root_employees からユーザー情報取得（本人の行は必ず取れる）
  const { data: emp, error: empError } = await supabase
    .from("root_employees")
    .select(
      [
        "employee_id",
        "employee_number",
        "name",
        "garden_role",
        "user_id",
        "is_active",
      ].join(","),
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<{
      employee_id: string;
      employee_number: string;
      name: string;
      garden_role: GardenRole | null;
      user_id: string;
      is_active: boolean;
    }>();

  if (empError || !emp) {
    return null;
  }

  const gardenRole = emp.garden_role;
  if (!gardenRole) {
    return null;
  }

  // Step 2: bud_users を取得（無ければ null のまま）
  const { data: bu } = await supabase
    .from("bud_users")
    .select("bud_role, is_active")
    .eq("employee_id", emp.employee_id)
    .eq("is_active", true)
    .maybeSingle<{ bud_role: BudRole; is_active: boolean }>();

  const budRole = bu?.bud_role ?? null;

  // Step 3: アクセス判定
  // 2-1: admin/super_admin は自動許可（bud_users 不要）
  //      effective_bud_role は明示登録があればそれ、無ければ 'admin' 扱い
  if (hasAutoAccess(gardenRole)) {
    return {
      employee_id: emp.employee_id,
      employee_number: emp.employee_number,
      name: emp.name,
      garden_role: gardenRole,
      user_id: emp.user_id,
      bud_role: budRole,
      effective_bud_role: budRole ?? "admin",
    };
  }

  // 2-2: それ以外は bud_users に登録が必要
  if (!budRole) {
    return null;
  }

  return {
    employee_id: emp.employee_id,
    employee_number: emp.employee_number,
    name: emp.name,
    garden_role: gardenRole,
    user_id: emp.user_id,
    bud_role: budRole,
    effective_bud_role: budRole,
  };
}
