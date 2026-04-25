/**
 * 週次通知テンプレート（scaffold §4.5 準拠）
 *
 * 毎週金曜 18:00 (JST) 配信。
 * グラフ画像は別途 uploadFile で送信する前提。本文字列には含めない。
 */

export type WeeklyInput = {
  /** "2026-W17" or "4/20 - 4/26" 等、ユーザー向けラベル */
  weekLabel: string;
  /** 今週の成果（文字列、複数行 OK） */
  achievements: string[];
  /** 月次目標達成率 (0-100) */
  monthlyGoalPct: number;
  /** アラート本文（空配列なら "なし" 表示） */
  alerts: string[];
  /** Bloom 公開 URL */
  bloomUrl: string;
};

function bulletize(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.map((s) => `・${s}`).join("\n");
}

export function renderWeekly(input: WeeklyInput): string {
  return [
    `[info][title]📊 Garden 週次サマリ（${input.weekLabel}）[/title]`,
    `🎯 今週の成果:`,
    bulletize(input.achievements, "（記録なし）"),
    ``,
    `📈 月次目標達成率: ${Math.round(input.monthlyGoalPct)}%`,
    ``,
    `⚠️ アラート:`,
    bulletize(input.alerts, "特になし"),
    ``,
    `🔗 グラフ画像（週次進捗）→ 添付`,
    `🔗 詳細: ${input.bloomUrl}/roadmap`,
    `[/info]`,
  ].join("\n");
}
