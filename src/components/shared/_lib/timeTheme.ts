/**
 * 時間帯テーマ判定ヘルパー（cross-ui-04 §4.1 準拠）
 *
 * 4 時間帯: morning / noon / evening / night
 * （季節バリエーションは Phase 2-2 以降で追加）
 *
 * 境界: 05-09=morning / 09-16=noon / 16-19=evening / 19-04=night（JST 想定、ブラウザローカル）
 */

export type TimeTheme = "morning" | "noon" | "evening" | "night";

export function getCurrentTimeTheme(now: Date = new Date()): TimeTheme {
  const hour = now.getHours();
  if (hour >= 5 && hour < 9) return "morning";
  if (hour >= 9 && hour < 16) return "noon";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}
