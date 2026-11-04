import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checked, loadLineData } from './tags.server';
import { chunks, recipients } from './tags';
import { getLineStaffQuota, pushLineStaff } from './staff-client';
import { sendGardenNotice } from '@/lib/relay/monitor.server';
import { validateScheduledAt, type ScheduledBroadcast } from './scheduled';

export async function loadScheduledBroadcasts() {
  const db = getSupabaseAdmin();
  const rows = checked(await db.from('system_line_broadcast').select('*')
    .in('schedule_status', ['scheduled', 'sending', 'failed'])
    .order('scheduled_at')).data as ScheduledBroadcast[];
  const ids = [...new Set(rows.map(row => row.created_by))];
  const people = ids.length
    ? checked(await db.from('root_employees').select('employee_id,name').in('employee_id', ids)).data ?? []
    : [];
  return rows.map(row => ({
    ...row,
    created_by_name: people.find(person => person.employee_id === row.created_by)?.name ?? '不明',
  }));
}

type ScheduleInput = {
  action: string;
  id?: unknown;
  title?: unknown;
  body?: unknown;
  tagIds?: unknown;
  scheduledAt?: unknown;
};

export async function manageSchedule(input: ScheduleInput, actor: string) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  if (input.action !== 'schedule' && (typeof input.id !== 'string' || !input.id)) {
    throw new Error('予約を選び直してください。');
  }
  if (input.action === 'scheduleCancel') {
    const result = checked(await db.from('system_line_broadcast')
      .update({ schedule_status: 'canceled', updated_by: actor, updated_at: now })
      .eq('id', input.id).in('schedule_status', ['scheduled', 'failed']).select('id'));
    if (!result.data?.length) throw new Error('送信中のため変更できません。');
    return { ok: true };
  }
  const scheduledAt = validateScheduledAt(input.scheduledAt);
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 ||
      typeof input.body !== 'string' || !input.body.trim() || input.body.length > 5000 ||
      !Array.isArray(input.tagIds) || input.tagIds.some(id => typeof id !== 'string')) {
    throw new Error('題名・文・タグを確認してください。');
  }
  const tags = checked(await db.from('system_line_tag').select('id')).data ?? [];
  if (input.tagIds.some(id => !tags.some(tag => tag.id === id))) {
    throw new Error('タグを選び直してください。');
  }
  const row = {
    title: input.title, body: input.body, tag_ids: input.tagIds,
    scheduled_at: scheduledAt, schedule_status: 'scheduled', schedule_error: null,
    updated_by: actor, updated_at: now,
  };
  if (input.action === 'schedule') {
    checked(await db.from('system_line_broadcast').insert({ ...row, created_by: actor, recipient_count: 0 }));
  } else {
    const result = checked(await db.from('system_line_broadcast').update(row)
      .eq('id', input.id).in('schedule_status', ['scheduled', 'failed']).select('id'));
    if (!result.data?.length) throw new Error('送信中のため変更できません。');
  }
  return { ok: true, scheduledAt };
}

async function notice(title: string, reason: string) {
  try {
    await sendGardenNotice(`公式LINEの予約送信「${title}」：${reason}`);
  } catch {
    // 通知障害でも予約を送信待ちに戻さない。
  }
}

export async function runScheduledBroadcasts(now = new Date()) {
  const db = getSupabaseAdmin();
  const timestamp = now.toISOString();
  const stale = checked(await db.from('system_line_broadcast').update({
    schedule_status: 'failed', schedule_error: '送信処理が途中で止まりました。送信状況を確認してください。', updated_at: timestamp,
  }).eq('schedule_status', 'sending')
    .lt('updated_at', new Date(now.getTime() - 30 * 60_000).toISOString()).select('id,title')).data ?? [];
  for (const row of stale) await notice(row.title, '送信処理が30分以上完了していません。自動で再送しません。');

  const due = checked(await db.from('system_line_broadcast').select('*')
    .eq('schedule_status', 'scheduled').lte('scheduled_at', timestamp)
    .order('scheduled_at')).data as ScheduledBroadcast[];
  let processed = 0;
  for (const candidate of due) {
    // 更新・取り消しと競合した場合も、取得時の日時のまま奪わない。
    const claim = checked(await db.from('system_line_broadcast')
      .update({ schedule_status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', candidate.id).eq('schedule_status', 'scheduled')
      .eq('updated_at', candidate.updated_at).lte('scheduled_at', timestamp).select('*'));
    const row = claim.data?.[0] as ScheduledBroadcast | undefined;
    if (!row) continue;
    processed++;
    try {
      const data = await loadLineData();
      const people = recipients(data.employees, row.tag_ids, data.tags, data.members);
      const ids = [...new Set(people.map(person => person.line_user_id!))];
      if (!ids.length) throw new Error('送信する人がいません。');
      const quota = await getLineStaffQuota();
      if (quota.remaining !== null && quota.remaining < ids.length) {
        throw new Error('今月の残り通数が足りません。');
      }
      let sent = 0;
      let failed = 0;
      for (const batch of chunks(ids)) {
        try {
          await pushLineStaff(batch, row.body);
          sent += batch.length;
        } catch {
          failed += batch.length;
        }
      }
      checked(await db.from('system_line_broadcast').update({
        sent_at: new Date().toISOString(), recipient_count: ids.length,
        sent_count: sent, failed_count: failed, schedule_status: null,
        schedule_error: failed ? `${failed}人への送信に失敗しました。` : null,
        updated_at: new Date().toISOString(),
      }).eq('id', row.id).eq('schedule_status', 'sending'));
      if (failed) await notice(row.title, `${failed}人への送信に失敗しました。`);
    } catch (error) {
      const reason = error instanceof Error && !error.message.startsWith('line_staff:')
        ? error.message : '送信の設定または通信状況を確認してください。';
      checked(await db.from('system_line_broadcast').update({
        schedule_status: 'failed', schedule_error: reason, updated_at: new Date().toISOString(),
      }).eq('id', row.id).eq('schedule_status', 'sending'));
      await notice(row.title, reason);
    }
  }
  return { ok: true, processed, interrupted: stale.length };
}
