/**
 * 盆栽ビュー — メインコンテナ（cross-ui-06 §3.2 準拠）
 *
 * 4 layer 重ね合わせ:
 *   1. BackgroundLayer (zIndex 0): 時間帯テーマ gradient / 将来は AI 画像
 *   2. BonsaiCenter   (zIndex 1): 中央 visual centerpiece（盆栽）
 *   3. ModuleLayer    (zIndex 2): 12 モジュールの中央基準配置
 *   4. ShojiStatusCloud (zIndex 10): 右上の雲（東海林ステータス）
 *
 * theme は呼び出し元（page.tsx）が getCurrentTimeTheme() で算出して渡す。
 * aspect-ratio 4:3 で desktop 主体。Phase 2-2 以降でモバイル fallback 検討。
 */

import { BackgroundLayer } from "./BackgroundLayer";
import { BonsaiCenter } from "./BonsaiCenter";
import { ModuleLayer } from "./ModuleLayer";
import { ShojiStatusCloud } from "./ShojiStatusCloud";
import type { TimeTheme } from "../_lib/timeTheme";

type Props = {
  /** 時間帯テーマ（page.tsx で getCurrentTimeTheme() で算出して渡す） */
  theme?: TimeTheme;
};

export function GardenView({ theme = "noon" }: Props) {
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
      <BackgroundLayer theme={theme} />
      <BonsaiCenter />
      <ModuleLayer />
      <ShojiStatusCloud />
    </div>
  );
}
