/**
 * 盆栽ビュー — メインコンテナ
 *
 * 3 layer 重ね合わせ:
 *   1. BackgroundLayer (zIndex 0): 背景画像 / グラデーション
 *   2. ModuleLayer (zIndex 2): 12 モジュールの絶対配置
 *   3. ShojiStatusCloud (zIndex 10): 右上の雲（東海林ステータス）
 *
 * aspect-ratio 4:3 で desktop 主体。Phase 2-1 でモバイル fallback 検討。
 */

import { BackgroundLayer } from "./BackgroundLayer";
import { ModuleLayer } from "./ModuleLayer";
import { ShojiStatusCloud } from "./ShojiStatusCloud";

export function GardenView() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4 / 3",
        maxWidth: 1200,
        minHeight: 480,
        margin: "0 auto",
        overflow: "hidden",
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
      }}
    >
      <BackgroundLayer />
      <ModuleLayer />
      <ShojiStatusCloud />
    </div>
  );
}
