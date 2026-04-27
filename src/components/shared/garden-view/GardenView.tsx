/**
 * 盆栽 / 大樹ビュー — メインコンテナ
 *
 * 4 layer 重ね合わせ:
 *   1. BackgroundCarousel (zIndex 0): 6 atmospheres カルーセル（dispatch v3）
 *   2. BonsaiCenter   (zIndex 1): 中央 visual centerpiece
 *   3. ModuleLayer    (zIndex 2): 12 モジュールの中央基準配置
 *   4. ShojiStatusCloud (zIndex 10): 右上の雲（東海林ステータス）
 *
 * Phase 2-2 候補 6 で BackgroundLayer → BackgroundCarousel 置換。
 * 旧 BackgroundLayer は @deprecated でファイル残置（CLAUDE.md no-deletion rule）。
 */

import { BackgroundCarousel } from "./BackgroundCarousel";
import { BonsaiCenter } from "./BonsaiCenter";
import { ModuleLayer } from "./ModuleLayer";
import { ShojiStatusCloud } from "./ShojiStatusCloud";
import type { AtmosphereId } from "./_lib/atmospheres";
import type { CarouselMode } from "./BackgroundCarousel";

type Props = {
  /** 初期 atmosphere（URL クエリ ?atmosphere=N から page.tsx で解決） */
  initialAtmosphere?: AtmosphereId;
  /** 初期カルーセルモード（5/5 デモは manual 開始、A キーで auto 切替） */
  initialMode?: CarouselMode;
};

export function GardenView({ initialAtmosphere = 0, initialMode = "manual" }: Props) {
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
      <BackgroundCarousel initialIndex={initialAtmosphere} initialMode={initialMode} />
      <BonsaiCenter />
      <ModuleLayer />
      <ShojiStatusCloud />
    </div>
  );
}
