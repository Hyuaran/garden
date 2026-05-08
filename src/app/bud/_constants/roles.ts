/**
 * Garden-Bud — ロール定数とアクセス判定ヘルパー
 *
 * GardenRole（7段階）の定義は Root の types.ts を参照。
 * ここでは Bud 固有の役割（3段階）とアクセス判定ルールを定義する。
 */

import type { GardenRole } from "../../root/_constants/types";
import type { BudRole } from "./types";

/** Bud 内役割の日本語ラベル */
export const BUD_ROLE_LABELS: Record<BudRole, string> = {
  admin: "Bud管理者",
  approver: "承認者",
  staff: "担当者",
};

/** Bud へのアクセスを自動許可する Garden ロール（bud_users への登録不要） */
export const BUD_AUTO_ACCESS_ROLES: GardenRole[] = ["admin", "super_admin"];

/** 指定した garden_role が自動的に Bud にアクセスできるか */
export function hasAutoAccess(role: GardenRole | null | undefined): boolean {
  if (!role) return false;
  return BUD_AUTO_ACCESS_ROLES.includes(role);
}

/** Bud 内役割の階層（弱 → 強） */
export const BUD_ROLE_ORDER: BudRole[] = ["staff", "approver", "admin"];

/** 指定 bud_role が基準以上の権限を持つか */
export function isBudRoleAtLeast(
  target: BudRole | null | undefined,
  baseline: BudRole,
): boolean {
  if (!target) return false;
  return BUD_ROLE_ORDER.indexOf(target) >= BUD_ROLE_ORDER.indexOf(baseline);
}
