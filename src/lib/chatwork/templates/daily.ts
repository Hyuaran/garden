/**
 * 日次通知テンプレート（scaffold §4.5 準拠）
 *
 * 毎日 18:00 (JST) = 09:00 UTC に配信。
 * 非技術者向けに simple モードラベル想定。呼び出し側で term-mapping を適用した
 * 文字列を渡すこと（本モジュールは文字列連結に専念）。
 */

export type DailyHighlight = string;
export type DailyUpcoming = string;

export type DailyInput = {
  /** YYYY-MM-DD */
  date: string;
  /** 完了タスク件数 */
  doneCount: number;
  /** 今日のハイライト（すでに文字列化済。3-5 件想定） */
  highlights: DailyHighlight[];
  /** 明日の予定 */
  tomorrow: DailyUpcoming[];
  /** Garden 全体進捗率 (0-100) */
  overallPct: number;
  /** 先週比（+ で改善、負で悪化） */
  diffPct: number;
  /** Bloom 公開 URL（"/bloom" までのルート） */
  bloomUrl: string;
};

function bulletize(items: string[], fallback = "（なし）"): string {
  if (items.length === 0) return fallback;
  return items.map((s) => `・${s}`).join("\n");
}

function sign(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return "±0";
}

export function renderDaily(input: DailyInput): string {
  return [
    `[info][title]📅 Garden 日次進捗（${input.date}）[/title]`,
    `✅ 完了タスク: ${input.doneCount} 件`,
    `📌 今日のハイライト:`,
    bulletize(input.highlights),
    ``,
    `📅 明日の予定:`,
    bulletize(input.tomorrow),
    ``,
    `📊 Garden 全体進捗: ${Math.round(input.overallPct)}%（先週比 ${sign(
      Math.round(input.diffPct),
    )}%）`,
    `🔗 詳細: ${input.bloomUrl}/roadmap`,
    `[/info]`,
  ].join("\n");
}
