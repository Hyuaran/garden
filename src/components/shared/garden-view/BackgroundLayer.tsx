/**
 * 盆栽ビュー — 背景レイヤー（差し替え可能）
 *
 * cross-ui-06 §3.3 + cross-ui-04 §4.1 準拠。
 * Phase 2-1: theme prop で時間帯ごとのグラデーション（AI 画像未着のため placeholder）
 * Phase 2-2 以降: imagePath prop で実画像に差し替え
 *
 * モジュール配置 layer（ModuleLayer）とは完全分離（memory project_godo_ux_adoption_gate）
 */

import type { TimeTheme } from "../_lib/timeTheme";

type Props = {
  /** 時間帯テーマ（gradient placeholder の選択に使用） */
  theme?: TimeTheme;
  /** 実画像パス（Phase 2-2 以降で AI 画像が用意され次第使用） */
  imagePath?: string;
  /** ダーク overlay 強度（0-1）、cross-ui-04 §3.4 ダーク時 0.30 想定 */
  overlayDark?: number;
};

const THEME_GRADIENTS: Record<TimeTheme, string> = {
  morning:
    "linear-gradient(180deg, #FFB88C 0%, #FFD9C2 35%, #FFE5D9 65%, #FAF8F3 100%)",
  noon:
    "linear-gradient(180deg, #87CEEB 0%, #B8E0F0 30%, #E0F6FF 60%, #FAF8F3 100%)",
  evening:
    "linear-gradient(180deg, #FF6B6B 0%, #FF9468 40%, #FFA07A 70%, #FAE6D8 100%)",
  night:
    "linear-gradient(180deg, #0D1B2A 0%, #1B2838 50%, #233044 100%)",
};

export function BackgroundLayer({
  theme = "noon",
  imagePath,
  overlayDark = 0,
}: Props) {
  const baseStyle = {
    position: "absolute" as const,
    inset: 0,
    zIndex: 0,
  };

  // 実画像が用意されていれば優先（Phase 2-2 以降）
  if (imagePath) {
    return (
      <>
        <div
          aria-hidden
          style={{
            ...baseStyle,
            backgroundImage: `url(${imagePath})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {overlayDark > 0 && (
          <div
            aria-hidden
            style={{
              ...baseStyle,
              background: `rgba(0, 0, 0, ${overlayDark})`,
              // zIndex 0 のまま（BackgroundLayer scope 内で完結、BonsaiCenter zIndex 1 と衝突しない）
            }}
          />
        )}
      </>
    );
  }

  // Phase 2-1: gradient placeholder
  return (
    <div
      aria-hidden
      style={{
        ...baseStyle,
        background: THEME_GRADIENTS[theme],
      }}
    />
  );
}
