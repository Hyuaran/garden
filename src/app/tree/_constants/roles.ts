/**
 * Garden-Tree 権限ロール定義
 *
 * - SPROUT  (芽)  : トス担当（新人〜中堅）
 * - BRANCH  (枝)  : クローザー（確定担当）
 * - MANAGER (幹)  : 責任者（マネージャー）
 */

import { C } from "./colors";

export const ROLES = {
  SPROUT: "sprout",
  BRANCH: "branch",
  MANAGER: "manager",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type RoleConfig = {
  label: string;      // 短い表示名
  fullLabel: string;  // フルネーム表示用
  color: string;      // バッジ・アクセントカラー
};

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  [ROLES.SPROUT]:  { label: "トス",       fullLabel: "トス",       color: "#c44a4a" },
  [ROLES.BRANCH]:  { label: "クローザ", fullLabel: "クローザー", color: C.gold },
  [ROLES.MANAGER]: { label: "責任者",     fullLabel: "責任者",     color: "#3478c6" },
};
