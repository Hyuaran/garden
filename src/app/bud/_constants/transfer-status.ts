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
 * ロール非依存の基本ルール。super_admin 自起票スキップは `canTransitionWithRole` を使用。
 */
export function canTransition(
  from: TransferStatus,
  to: TransferStatus,
): boolean {
  return TRANSFER_STATUS_TRANSITIONS[from].includes(to);
}

export type BudTransitionRole = "staff" | "approver" | "admin" | "super_admin";

/**
 * ロールを考慮した遷移可否判定。
 *
 * DB 側の `bud_can_transition(text, text, text)` と完全一致させること。
 * A-03 判3: super_admin が「下書き → 承認済み」へ直接遷移可（自起票スキップ）。
 * それ以外は `canTransition` と同じ判定。
 */
export function canTransitionWithRole(
  from: TransferStatus,
  to: TransferStatus,
  role: BudTransitionRole,
): boolean {
  if (role === "super_admin" && from === "下書き" && to === "承認済み") {
    return true;
  }
  return canTransition(from, to);
}
