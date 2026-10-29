export type Kind = 'toss' | 'closer';
export const coinKeys = ['coin_created','guide_promised','guide_in_progress','statement_check_request','coin_total'] as const;
export type Report = {
  report_date: string; kind: Kind; start_time: string; end_time: string; work_minutes: number;
  calls: number; absent: number; prospect: number; effective_rate: number; auto_count: number;
  count: number; month_total: number; efficiency: number; reflection: string;
  sent_count: number; employee_name: string;
} & Record<typeof coinKeys[number], number | null>;
export function fixedKind(role: string): Kind | null { return role === 'toss' || role === 'closer' ? role : null; }
export function minutes(time: string) { const [h,m] = time.split(':').map(Number); return h*60+m; }
export function validateReport(value: unknown): Report {
  if (!value || typeof value !== 'object') throw new Error('入力内容を確認してください');
  const r = value as Report;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.report_date) || !Number.isFinite(Date.parse(r.report_date)) || new Date(r.report_date).toISOString().slice(0,10) !== r.report_date) throw new Error('日付を確認してください');
  if (r.kind !== 'toss' && r.kind !== 'closer') throw new Error('区分を選んでください');
  if (![r.start_time,r.end_time].every(t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || minutes(r.end_time) <= minutes(r.start_time)) throw new Error('開始・終了時間を確認してください');
  if (!Number.isInteger(r.work_minutes) || r.work_minutes < 0 || r.work_minutes > minutes(r.end_time)-minutes(r.start_time)) throw new Error('稼働時間を確認してください');
  if (!Number.isSafeInteger(r.count) || r.count < 0 || !Number.isFinite(r.month_total) || r.month_total < 0 || Math.abs(r.month_total*10-Math.round(r.month_total*10)) > 1e-7) throw new Error('件数を確認してください');
  for (const k of coinKeys) if (r[k] != null && (!Number.isSafeInteger(r[k]) || r[k]! < 0)) throw new Error('コインの件数を確認してください');
  if (typeof r.reflection !== 'string' || !r.reflection.trim() || r.reflection.length > 5000) throw new Error('反省点・改善点を入力してください（5000文字以内）');
  return r;
}
export function buildMessage(r: Report, correction = false) {
  const [,month,day] = r.report_date.split('-').map(Number);
  const time = (t: string) => t.slice(0,5).replace(':','：');
  return `${correction ? '（訂正）\n' : ''}【${r.employee_name.trim().split(/[\s\u3000]+/)[0]}】\n${month}月${day}日　${time(r.start_time)}～${time(r.end_time)}　　${Number((r.work_minutes/60).toFixed(2))}時間稼働\n総コール${r.calls}件(留守${r.absent}件)（見込み${r.prospect}件）\n有効率${r.effective_rate.toFixed(1)}%（繋がった数÷総コール数）\n\n${r.kind === 'toss' ? `トス${r.count}件` : `本日獲得　${r.count}件\n現状合計　${r.month_total.toFixed(1)}件　効率${r.efficiency.toFixed(2)}`}\n\n【反省点】【それに対しての改善点】\n${r.reflection}`;
}
export type Punch = { punch_type: string; punched_at: string };
export function attendance(punches: Punch[]) {
  let active: number | null = null, total = 0, start = '', end = '';
  const time = (s: string) => new Date(new Date(s).getTime()+9*3600000).toISOString().slice(11,16);
  for (const p of [...punches].sort((a,b)=>a.punched_at.localeCompare(b.punched_at))) {
    const at = Date.parse(p.punched_at);
    if (p.punch_type === 'clock_in') { start ||= time(p.punched_at); if (active === null) active = at; }
    if (p.punch_type === 'break_end' && start && active === null) active = at;
    if (p.punch_type === 'clock_out' || p.punch_type === 'break_start') {
      if (active !== null) total += Math.max(0,at-active);
      active = null;
      if (p.punch_type === 'clock_out') end = time(p.punched_at);
    }
  }
  return { start_time: start, end_time: end, work_minutes: Math.round(total/60000) };
}
