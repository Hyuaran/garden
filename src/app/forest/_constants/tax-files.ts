/**
 * Garden-Forest Tax Files 関連定数。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §4
 *
 * Forest はインラインスタイル規約（_constants/theme.ts L9 参照）のため、
 * spec の Tailwind クラス指定は色値（hex）に変換して保持。
 */

import type { TaxFileStatus } from "../_lib/types";

/** ステータスバッジの表示ラベルと色。 */
export const TAX_FILE_STATUS_LABELS: Record<
  TaxFileStatus,
  { label: string; color: string; fontWeight: number }
> = {
  zanntei: { label: "暫定", color: "#7a9a7a", fontWeight: 400 },
  kakutei: { label: "確定", color: "#1b4332", fontWeight: 600 },
};

/** ファイル拡張子別アイコンの色とテキスト。 */
export const TAX_FILE_ICON_CONFIG: Record<
  string,
  { background: string; label: string }
> = {
  pdf: { background: "#5a7a5a", label: "PDF" },
  xlsx: { background: "#1b4332", label: "XLSX" },
  xls: { background: "#1b4332", label: "XLS" },
  csv: { background: "#5a7a5a", label: "CSV" },
  jpg: { background: "#7a9a7a", label: "JPG" },
  jpeg: { background: "#7a9a7a", label: "JPG" },
  png: { background: "#7a9a7a", label: "PNG" },
};

/** 拡張子辞書に該当しない場合の fallback。 */
export const TAX_FILE_ICON_FALLBACK_BG = "#e07a7a";

/** TaxFilesList の法人表示順（v9 L1704 準拠）。 */
export const TAX_FILE_COMPANY_ORDER: readonly string[] = [
  "hyuaran",
  "centerrise",
  "linksupport",
  "arata",
  "taiyou",
  "ichi",
] as const;
