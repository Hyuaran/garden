export type WorkerStatusKind = 'available' | 'busy_light' | 'focus' | 'away';

export const WORKER_STATUS_LABELS: Record<
  WorkerStatusKind,
  { icon: string; label: string; sub: string }
> = {
  available: { icon: '🟢', label: '対応可能', sub: '質問・依頼OK' },
  busy_light: { icon: '🟡', label: '取り込み中', sub: '電話可、メッセは後回し' },
  focus: { icon: '🔴', label: '集中業務中', sub: '緊急以外は避けて' },
  away: { icon: '⚪', label: '外出中', sub: '翌日以降対応' },
};

export type WorkerStatus = {
  user_id: string;
  status: WorkerStatusKind;
  status_note: string | null;
  until: string | null;
  updated_at: string;
  updated_by: string | null;
};
