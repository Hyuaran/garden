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
