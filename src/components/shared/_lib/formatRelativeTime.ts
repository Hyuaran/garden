export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "不明";
  const t = new Date(iso).getTime();
  const diffSec = Math.floor((now.getTime() - t) / 1000);
  if (diffSec < 60) return "今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 時間前`;
  return `${Math.floor(diffSec / 86400)} 日前`;
}

const STALE_MS = 30 * 60 * 1000;

export function isStale(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return true;
  return now.getTime() - new Date(iso).getTime() >= STALE_MS;
}
