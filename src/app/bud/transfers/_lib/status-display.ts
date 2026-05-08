/**
 * Garden-Bud / 振込ステータスの表示補助
 *
 * ステータスごとの色分け・進行順・終端判定。
 * UI での見た目統一のため純関数として切り出し。
 */

import type { TransferStatus } from "../../_constants/transfer-status";

/** Tailwind の色名（bg-{color}-100 text-{color}-800 等で使う） */
export type StatusColor =
  | "gray"
  | "blue"
  | "yellow"
  | "emerald"
  | "indigo"
  | "green"
  | "red";

const STATUS_COLOR_MAP: Record<TransferStatus, StatusColor> = {
  下書き: "gray",
  確認済み: "blue",
  承認待ち: "yellow",
  承認済み: "emerald",
  CSV出力済み: "indigo",
  振込完了: "green",
  差戻し: "red",
};

export function getStatusColor(status: TransferStatus): StatusColor {
  return STATUS_COLOR_MAP[status];
}

const STATUS_ORDER_MAP: Record<TransferStatus, number> = {
  下書き: 1,
  確認済み: 2,
  承認待ち: 3,
  承認済み: 4,
  CSV出力済み: 5,
  振込完了: 6,
  差戻し: 0, // 正規フローから外れる
};

export function getStatusOrder(status: TransferStatus): number {
  return STATUS_ORDER_MAP[status];
}

export function isTerminalStatus(status: TransferStatus): boolean {
  return status === "振込完了";
}
