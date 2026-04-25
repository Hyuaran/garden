/**
 * 重要アラートテンプレート（scaffold §4.5 準拠）
 *
 * PR マージ / Phase 完了 / スケジュール変更 / 障害等、随時配信用。
 */

export type AlertSeverity = "info" | "warn" | "critical";

export type AlertInput = {
  severity: AlertSeverity;
  subject: string;
  /** ISO 8601 or 日時文字列 */
  occurredAt: string;
  /** 影響範囲（モジュール名 / 人 / 機能等） */
  scope: string;
  /** 本文（複数行可） */
  detail: string;
  /** 詳細リンク（PR URL / ダッシュボード URL 等） */
  url?: string;
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "ℹ️ お知らせ",
  warn: "⚠ 注意",
  critical: "🚨 緊急",
};

export function renderAlert(input: AlertInput): string {
  const lines = [
    `[info][title]${SEVERITY_LABEL[input.severity]} — ${input.subject}[/title]`,
    `発生: ${input.occurredAt}`,
    `影響範囲: ${input.scope}`,
    `内容: ${input.detail}`,
  ];
  if (input.url) {
    lines.push("", `🔗 詳細: ${input.url}`);
  }
  lines.push(`[/info]`);
  return lines.join("\n");
}
