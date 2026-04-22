/**
 * Garden-Bud / 振込ステータス定義
 *
 * Phase 1b で扱う 6 段階のステータスと、その遷移ルールを定義する。
 * Kintone の「二重チェック」は「確認済み」ステータスに対応。
 */

export const TRANSFER_STATUSES = [
  "下書き",
  "確認済み",
  "承認待ち",
  "承認済み",
  "CSV出力済み",
  "振込完了",
  "差戻し",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** キャッシュバック申請のサブステータス（Phase 1c で Leaf から流れ込む）*/
export const CASHBACK_APPLICATION_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "returned",
] as const;

export type CashbackApplicationStatus =
  (typeof CASHBACK_APPLICATION_STATUSES)[number];

/**
 * 状態遷移テーブル。
 * キー: 現ステータス
 * 値: そのステータスから許可される次ステータスの配列
 *
 * super_admin の自起票スキップ（下書き → 承認済み）は UI/RLS 側で制御。
 */
export const TRANSFER_STATUS_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  下書き: ["確認済み", "差戻し"],
  確認済み: ["承認待ち", "下書き"], // 下書きに戻せる（修正用）
  承認待ち: ["承認済み", "差戻し"],
  承認済み: ["CSV出力済み"],
  CSV出力済み: ["振込完了"],
  振込完了: [], // 終端
  差戻し: ["下書き"], // 起票者が修正して再提出
};

/**
 * 指定の遷移が許可されているか判定（純関数・テスト容易）。
 */
export function canTransition(
  from: TransferStatus,
  to: TransferStatus,
): boolean {
  return TRANSFER_STATUS_TRANSITIONS[from].includes(to);
}
