/**
 * 6 atmospheres カルーセル定義（NotebookLM Digital Terrarium）
 *
 * cycle 順は東海林さんが 5/5 後道さんデモで「穏やか → 朝もや → 活力 → 精密 → 連携 → 循環」
 * の流れを引き出すために最適化（dispatch v3 §2 準拠）。
 *
 * imagePath は public/themes/atmospheres/ 配下の WebP（prefix 数字 = cycle order）。
 */

export type AtmosphereId = 0 | 1 | 2 | 3 | 4 | 5;

export type Atmosphere = {
  id: AtmosphereId;
  key: string;
  /** 後道さんへの口頭ラベル（「穏やか」「朝もや」等） */
  shortLabel: string;
  imagePath: string;
};

export const ATMOSPHERES: readonly Atmosphere[] = [
  { id: 0, key: "watercolor-tree",       shortLabel: "穏やか",  imagePath: "/themes/atmospheres/01-watercolor-tree.webp" },
  { id: 1, key: "morning-calm",          shortLabel: "朝もや",  imagePath: "/themes/atmospheres/02-morning-calm.webp" },
  { id: 2, key: "dynamic-energy",        shortLabel: "活力",    imagePath: "/themes/atmospheres/03-dynamic-energy.webp" },
  { id: 3, key: "analytical-precision",  shortLabel: "精密",    imagePath: "/themes/atmospheres/04-analytical-precision.webp" },
  { id: 4, key: "system-sync",           shortLabel: "連携",    imagePath: "/themes/atmospheres/05-system-sync.webp" },
  { id: 5, key: "workflow-flow",         shortLabel: "循環",    imagePath: "/themes/atmospheres/06-workflow-flow.webp" },
];

/**
 * V7 dispatch (2026-04-27): 東海林さん指定の本物 v2 画像 6 枚（public/images/atmospheres/01.png〜06.png）
 * 旧 ATMOSPHERES（digital-terrarium / webp）は test 互換維持で残置。
 * V7 以降のホーム背景は ATMOSPHERES_V2 を使用。
 */
export const ATMOSPHERES_V2: readonly Atmosphere[] = [
  { id: 0, key: "vivid-canopy",       shortLabel: "Vivid Canopy（鮮やかな樹冠）",      imagePath: "/images/atmospheres/01.png" },
  { id: 1, key: "aqua-stream",        shortLabel: "Aqua Stream（水流のテラリウム）",   imagePath: "/images/atmospheres/02.png" },
  { id: 2, key: "digital-sanctuary",  shortLabel: "Digital Sanctuary（デジタル神聖樹）", imagePath: "/images/atmospheres/03.png" },
  { id: 3, key: "crystal-clear",      shortLabel: "Crystal Clear（結晶ガラス）",        imagePath: "/images/atmospheres/04.png" },
  { id: 4, key: "golden-light",       shortLabel: "Golden Light（光降る朝）",          imagePath: "/images/atmospheres/05.png" },
  { id: 5, key: "watercolor-serene",  shortLabel: "Watercolor Serene（静謐水彩）",     imagePath: "/images/atmospheres/06.png" },
];

export const ATMOSPHERE_COUNT = 6;
export const AUTO_INTERVAL_MS = 8000;
export const FADE_TRANSITION_MS = 800;

/** URL クエリ ?atmosphere=N から AtmosphereId を解決（範囲外は 0） */
export function resolveAtmosphereParam(raw: string | string[] | undefined): AtmosphereId {
  if (typeof raw !== "string") return 0;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n >= ATMOSPHERE_COUNT) return 0;
  return n as AtmosphereId;
}
