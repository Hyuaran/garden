/**
 * 盆栽ビュー — 12 モジュールの絶対配置（% from container）
 *
 * 座標は背景画像と独立。背景差し替え（cross-ui-04 改訂版受領後）でも layout 不変。
 * 値は Phase 2-0 placeholder。a-auto 改訂版 cross-ui-06 受領後に上書き想定。
 *
 * 配置イメージ（盆栽中央 + 周辺モジュール）:
 *   Tree=幹中央 / Soil=鉢の根元 / Root=地下
 *   Leaf/Bud=枝の上 / Bloom/Fruit=枝の下
 *   Forest/Rill=周辺 / Seed/Sprout/Calendar=空の周辺
 */

import type { ModuleKey } from "./modules";

export type Position = { left: string; top: string };

export const SLOT_POSITIONS: Record<ModuleKey, Position> = {
  tree:     { left: "50%", top: "45%" },
  soil:     { left: "50%", top: "85%" },
  root:     { left: "50%", top: "97%" },
  leaf:     { left: "32%", top: "30%" },
  bud:      { left: "68%", top: "30%" },
  bloom:    { left: "22%", top: "55%" },
  fruit:    { left: "78%", top: "55%" },
  forest:   { left: "8%",  top: "78%" },
  rill:     { left: "92%", top: "78%" },
  seed:     { left: "10%", top: "15%" },
  sprout:   { left: "32%", top: "12%" },
  calendar: { left: "90%", top: "12%" },
};
