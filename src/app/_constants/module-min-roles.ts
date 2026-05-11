/**
 * Garden 12 モジュールの最低必要ロール (2026-05-11、Task 3)
 *
 * ModuleGate.tsx が参照する minRole の一元管理ファイル。
 * 各モジュール layout で `module="bloom"` を指定すれば本ファイルから自動取得される。
 *
 * 設計方針:
 *   - memory project_configurable_permission_policies.md:
 *     「権限閾値はハードコード禁止、root_settings で admin 変更可能」
 *     → MVP は本 constant、Phase B-2 で root_settings.module_min_roles_overrides
 *       (jsonb) 経由で override 可能化予定
 *
 * 確定マトリクス (plan §Task 3 §Step 3-2):
 *   | module    | minRole  | 備考                                    |
 *   |-----------|----------|-----------------------------------------|
 *   | soil      | admin    | DB 基盤、staff には不可視               |
 *   | root      | manager  | マスタ閲覧（manager 以上）              |
 *   | tree      | toss     | 全ロール OK（コールセンター）           |
 *   | leaf      | staff    | 商材データ                              |
 *   | bud       | manager  | 経理（manager 以上）                    |
 *   | bloom     | staff    | 業務管理                                |
 *   | seed      | staff    | 新事業枠                                |
 *   | forest    | manager  | 経営ダッシュボード（manager 以上）      |
 *   | rill      | admin    | メッセージ、β 後 staff 化検討           |
 *   | fruit     | manager  | 法人法的実体情報                        |
 *   | sprout    | staff    | 採用                                    |
 *   | calendar  | staff    | 営業予定・面接スロット                  |
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-2
 */

import type { GardenRole } from "../root/_constants/types";

export type GardenModule =
  | "soil"
  | "root"
  | "tree"
  | "leaf"
  | "bud"
  | "bloom"
  | "seed"
  | "forest"
  | "rill"
  | "fruit"
  | "sprout"
  | "calendar";

export const MODULE_MIN_ROLES: Record<GardenModule, GardenRole> = {
  soil: "admin", // staff には Soil 不可視
  root: "manager",
  tree: "toss",
  leaf: "staff",
  bud: "manager",
  bloom: "staff",
  seed: "staff",
  forest: "manager",
  rill: "admin", // staff には Rill 不可視（β 後に staff 化検討）
  fruit: "manager",
  sprout: "staff",
  calendar: "staff",
};

// ----------------------------------------------------------------------------
// TODO(Phase B-2): root_settings.module_min_roles_overrides (jsonb) を読み、
//   admin が UI から module 最低ロールを上書きできるようにする。
//   memory project_configurable_permission_policies.md
// ----------------------------------------------------------------------------
