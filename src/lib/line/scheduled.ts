export type ScheduledBroadcast = {
  id: string;
  title: string;
  body: string;
  tag_ids: string[];
  scheduled_at: string;
  schedule_status: 'scheduled' | 'sending' | 'failed';
  schedule_error: string | null;
  created_by: string;
  created_by_name?: string;
  updated_at: string;
};

export const scheduleTimes = Array.from({ length: 72 }, (_, index) => {
  const minutes = 9 * 60 + index * 10;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export function validateScheduledAt(value: unknown, now = new Date()) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('送信日時を選んでください。');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('送信日時を選んでください。');
  const local = new Date(date.getTime() + 9 * 3600_000);
  if (local.getUTCMinutes() % 10 || local.getUTCSeconds() || local.getUTCMilliseconds()) {
    throw new Error('送信時刻は10分刻みで選んでください。');
  }
  if (local.getUTCHours() < 9 || local.getUTCHours() >= 21) {
    throw new Error('送信時刻は9:00から20:50までで選んでください。');
  }
  const limit = new Date(now.getTime() + 9 * 3600_000);
  const day = limit.getUTCDate();
  limit.setUTCDate(1);
  limit.setUTCMonth(limit.getUTCMonth() + 3);
  const end = new Date(limit);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  limit.setUTCDate(Math.min(day, end.getUTCDate()));
  if (date.getTime() < now.getTime() + 10 * 60_000 || date.getTime() > limit.getTime() - 9 * 3600_000) {
    throw new Error('送信日時は今から10分以上先、3か月以内で選んでください。');
  }
  return date.toISOString();
}

export function scheduleDateLabel(value: string, includeSeconds = false) {
  return new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    ...(includeSeconds ? { second: '2-digit' as const } : {}),
  });
}
