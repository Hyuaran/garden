/**
 * Garden 12 モジュール × 8 role の表示マトリクス
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 2 §Step 2-1
 *      および §Integration Notes §IN-3（確定版マトリクス）
 *
 * memory 準拠:
 *   - project_garden_dual_axis_navigation §「staff 以上に集約サイドバー」
 *   - project_configurable_permission_policies §「ハードコード禁止」
 *     → MVP は constant、Phase B-2 で root_settings.module_visibility_overrides (jsonb) に移行
 *
 * 利用箇所:
 *   - src/app/page.tsx (server)            : role 取得 → visibleModules を流す + 強制 redirect
 *   - src/app/_components/home/OrbGrid.tsx : visibleModules filter
 *   - src/app/_components/layout/Sidebar.tsx : visibleModules filter
 *   - Task 6 のテスト                       : getModuleVisibility(role, module) 経由
 */

export const MODULE_KEYS = [
  // row 1: 樹冠レイヤー
  "Bloom",
  "Fruit",
  "Seed",
  "Forest",
  // row 2: 地上レイヤー
  "Bud",
  "Leaf",
  "Tree",
  "Sprout",
  // row 3: 地下レイヤー
  "Soil",
  "Root",
  "Rill",
  "Calendar",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * Garden 全体ロール（8 段階、root/_constants/types.ts の GardenRole と一致）
 *
 * 本ファイルは server component / client / vitest 共通で読み込まれる薄い constant のため、
 * 型のみ独立定義（root/_constants/types.ts 取り込み時に "use client" 配下から server 参照不可問題を避ける）。
 */
export type GardenRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "staff"
  | "cs"
  | "closer"
  | "toss"
  | "outsource";

const ALL_MODULES: ModuleKey[] = [...MODULE_KEYS];

/**
 * 確定マトリクス（plan §IN-3）
 *
 * | role         | 表示 module 数 | 備考                                    |
 * |--------------|---------------|-----------------------------------------|
 * | super_admin  | 12            | 全 module                               |
 * | admin        | 12            | 全 module                               |
 * | manager      | 12            | 全 module                               |
 * | staff        | 10            | Soil / Rill 不可                        |
 * | cs           | 4             | Bloom / Tree / Leaf / Calendar のみ     |
 * | closer       | 0             | /home 到達不可、強制 /tree              |
 * | toss         | 0             | /home 到達不可、強制 /tree              |
 * | outsource    | 0             | /home 到達不可、強制 /leaf/kanden       |
 */
export const DEFAULT_VISIBILITY_MATRIX: Record<GardenRole, ModuleKey[]> = {
  super_admin: ALL_MODULES,
  admin: ALL_MODULES,
  manager: ALL_MODULES,
  staff: [
    "Bloom",
    "Fruit",
    "Seed",
    "Forest",
    "Bud",
    "Leaf",
    "Tree",
    "Sprout",
    "Root",
    "Calendar",
  ], // Soil / Rill 不可
  cs: ["Bloom", "Tree", "Leaf", "Calendar"],
  closer: [],
  toss: [],
  outsource: [],
};

/**
 * role 別に表示すべき module key 配列を返す。
 *
 * - 未ログイン / 不明 role は staff（10 module）にフォールバック
 *   （/home 到達時点で認証は通過済みのため、最も狭い「一般社員」相当を採用）
 */
export function getVisibleModules(
  role: string | null | undefined,
): ModuleKey[] {
  if (!role) return DEFAULT_VISIBILITY_MATRIX.staff;
  if (role in DEFAULT_VISIBILITY_MATRIX) {
    return DEFAULT_VISIBILITY_MATRIX[role as GardenRole];
  }
  return DEFAULT_VISIBILITY_MATRIX.staff;
}

/**
 * Task 6 テストや ModuleGate.tsx 互換のための薄い wrapper (plan §IN-2)
 *
 * @example
 *   getModuleVisibility("cs", "Forest") // { canView: false }
 *   getModuleVisibility("staff", "Soil") // { canView: false }
 *   getModuleVisibility("admin", "Bloom") // { canView: true }
 */
export function getModuleVisibility(
  role: string | null | undefined,
  module: ModuleKey,
): { canView: boolean } {
  return { canView: getVisibleModules(role).includes(module) };
}

/**
 * /home (`/`) への到達自体を許可しない role 一覧
 * （直 URL 入力時の保険として page.tsx server side で強制 redirect する）
 */
export const HOME_FORBIDDEN_ROLES: GardenRole[] = [
  "closer",
  "toss",
  "outsource",
];

export function isHomeForbidden(role: string | null | undefined): boolean {
  if (!role) return false;
  return (HOME_FORBIDDEN_ROLES as string[]).includes(role);
}

// ----------------------------------------------------------------------------
// TODO(Phase B-2): root_settings.module_visibility_overrides (jsonb) を読み、
//   admin が UI から module 表示権限を上書きできるようにする。
//   memory project_configurable_permission_policies §「権限閾値はハードコード禁止」
//   現状 MVP は本ファイルの constant のみで運用する。
// ----------------------------------------------------------------------------
