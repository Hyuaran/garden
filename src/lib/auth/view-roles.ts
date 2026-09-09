import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";

/**
 * 画面・API の入口が共通で使う役職の集合。
 * page.tsx／layout.tsx／route.ts から直接 export すると Next のビルド検査
 * （許可されていない export）で落ちるため、ここに置いて各入口と権限一覧の両方から参照する。
 */

/** 責任者以上：契約書管理・テレマ日報 API */
export const MANAGER_VIEW_ROLES: ReadonlySet<GardenRole> = new Set<GardenRole>(["manager", "admin", "super_admin"]);

/** 正社員以上（業務委託を含む）：テレマ コール集計の画面と API（2026-09-09 東海林さん決定で責任者以上から変更） */
export const STAFF_VIEW_ROLES: ReadonlySet<GardenRole> = new Set<GardenRole>(GARDEN_ROLE_ORDER.filter((role) => isRoleAtLeast(role, "staff")));
