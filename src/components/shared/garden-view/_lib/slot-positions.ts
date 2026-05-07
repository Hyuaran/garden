/**
 * 3 レイヤー大樹ビュー — 12 モジュールの中央基準座標
 *
 * memory project_garden_3layer_visual_model + cross-ui-06 §2.4 の融合：
 *   - Layer 3 樹冠 (top 5-30% = y -45 to -20): Bloom / Fruit / Seed / Forest / Calendar
 *   - Layer 2 地上 (top 35-65% = y -15 to +15): Bud / Leaf / Tree / Sprout
 *   - Layer 1 地下 (top 70-95% = y +20 to +45): Soil / Root / Rill
 *
 * 座標系: (0, 0) = container 中央 = BonsaiCenter / 大樹幹の位置
 *   x: 負=左 / 正=右（% from center）
 *   y: 負=上 / 正=下（% from center）
 *
 * ModuleSlot 内での CSS 変換:
 *   left: ${50 + x}%; top: ${50 + y}%; transform: translate(-50%, -50%);
 *
 * 各レイヤー内では X を分散配置して視認性確保。
 * 配置の意味付けは memory project_garden_3layer_visual_model 参照。
 */

import type { ModuleKey } from "./modules";

export type Position = { x: number; y: number };

export const SLOT_POSITIONS: Record<ModuleKey, Position> = {
  // Layer 3 樹冠（y -45 to -20、5 modules）
  calendar: { x: -40, y: -30 },  // 左空（暦・月）
  forest:   { x:  40, y: -30 },  // 右空（森・全体俯瞰）
  bloom:    { x: -20, y: -22 },  // 樹冠左（花、KPI）
  fruit:    { x:  20, y: -22 },  // 樹冠右（実、成果物）
  seed:     { x:   0, y: -40 },  // 樹冠最上（種、新事業）

  // Layer 2 地上（y -15 to +15、4 modules）
  tree:     { x: -30, y:   0 },  // 左幹（架電、業務の主軸）
  bud:      { x:  30, y: -10 },  // 右枝上（蕾、経理）
  leaf:     { x:  30, y:  10 },  // 右枝下（葉、商材）
  sprout:   { x: -15, y:  10 },  // 中央左下（新芽、オンボーディング）

  // Layer 1 地下（y +20 to +45、3 modules）
  soil:     { x: -30, y:  25 },  // 左下（土、データ基盤）
  root:     { x:   0, y:  40 },  // 中央深部（根、組織マスタ）
  rill:     { x:  30, y:  30 },  // 右下（地下水脈、メッセージ流通）
};
