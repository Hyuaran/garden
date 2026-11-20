// 関電の送信フォーム・事務入力の展開日（東海林さん 2026-11-20「展開は 12/1〜」）。
// それまでは全権管理者だけが試しに使える。
export const KANDEN_ROLLOUT = "2026-12-01";

export function japanToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export function kandenOpen(role: string | null | undefined, today = japanToday()) {
  return today >= KANDEN_ROLLOUT || role === "super_admin";
}
