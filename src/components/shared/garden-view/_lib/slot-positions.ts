/**
 * 盆栽ビュー — 12 モジュールの中央基準座標（cross-ui-06 §2.4 準拠）
 *
 * 座標系: (0, 0) = container 中央 = BonsaiCenter の位置
 *   x: 負=左 / 正=右（% from center）
 *   y: 負=上 / 正=下（% from center）
 *
 * ModuleSlot 内での CSS 変換:
 *   left: ${50 + x}%; top: ${50 + y}%; transform: translate(-50%, -50%);
 *
 * 配置の意味付けは cross-ui-06 §2.4 表 を参照（盆栽の枝・葉・根 等）
 */

import type { ModuleKey } from "./modules";

export type Position = { x: number; y: number };

export const SLOT_POSITIONS: Record<ModuleKey, Position> = {
  // 上部（空 / 周辺）
  calendar: { x: -35, y: -30 },  // 左上奥（暦・月）
  forest:   { x:  35, y: -30 },  // 右上奥（森）
  // 中段（枝の高さ）
  rill:     { x: -45, y:  -5 },  // 左中（川）
  bud:      { x:  45, y:  -5 },  // 右中（蕾、枝先）
  tree:     { x: -25, y:   5 },  // 中央左（架電、幹寄り）
  bloom:    { x:  25, y:   5 },  // 中央右（花、枝先）
  // 下段（根元・地面）
  fruit:    { x:   0, y:  30 },  // 中央枝先（実）
  soil:     { x: -35, y:  25 },  // 左下（土）
  leaf:     { x:  35, y:  25 },  // 右下（葉）
  root:     { x: -20, y:  35 },  // 左下中（根）
  seed:     { x:   0, y:  40 },  // 中央下（種）
  sprout:   { x:  20, y:  35 },  // 右下中（芽）
};
