import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Employee } from './tags';

const mocks = vi.hoisted(() => ({ db: vi.fn(), load: vi.fn(), quota: vi.fn(), push: vi.fn(), notice: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: mocks.db }));
vi.mock('./tags.server', () => ({ loadLineData: mocks.load, checked: (result: { error: unknown }) => {
  if (result.error) throw result.error;
  return result;
} }));
vi.mock('./staff-client', () => ({ getLineStaffQuota: mocks.quota, pushLineStaff: mocks.push }));
vi.mock('@/lib/relay/monitor.server', () => ({ sendGardenNotice: mocks.notice }));
import { manageSchedule, runScheduledBroadcasts } from './scheduled.server';

type Row = Record<string, unknown>;
let rows: Row[];
let loseClaim = false;
function database() {
  return { from: () => {
    const filters: ((row: Row) => boolean)[] = [];
    let patch: Row | undefined;
    const query = {
      select: () => query,
      update: (value: Row) => { patch = value; return query; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      lt: (key: string, value: string) => { filters.push(row => String(row[key]) < value); return query; },
      lte: (key: string, value: string) => { filters.push(row => String(row[key]) <= value); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => {
        const matches = loseClaim && patch?.schedule_status === 'sending' ? [] : rows.filter(row => filters.every(filter => filter(row)));
        const data = matches.map(row => {
          if (patch) Object.assign(row, patch);
          return { ...row };
        });
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  } };
}
const person = (id: string): Employee => ({ employee_id: id, employee_number: id, name: id,
  employment_type: '正社員', garden_role: 'staff', hire_date: null, termination_date: null,
  is_active: true, line_user_id: `U${id}`, line_link_source: 'self' });
beforeEach(() => {
  vi.resetAllMocks();
  loseClaim = false;
  rows = [{ id: 'one', title: '予約した題名', body: '本文', tag_ids: ['tag'],
    scheduled_at: '2026-11-04T00:00:00.000Z', schedule_status: 'scheduled', updated_at: '2026-11-03T00:00:00.000Z' }];
  mocks.db.mockImplementation(database);
  mocks.load.mockResolvedValue({ employees: [person('new'), { ...person('old'), is_active: false }],
    tags: [{ id: 'tag', kind: 'free' }], members: [{ employee_id: 'new', tag_id: 'tag' }] });
  mocks.quota.mockResolvedValue({ remaining: 1000 });
  mocks.push.mockResolvedValue(undefined);
});
const run = () => runScheduledBroadcasts(new Date('2026-11-04T01:00:00Z'));
afterEach(() => vi.useRealTimers());
it('送信時の名簿とタグで宛先を決め、完了した予約を再送しない', async () => {
  await run();
  expect(mocks.push).toHaveBeenCalledWith(['Unew'], '本文');
  expect(rows[0]).toMatchObject({ schedule_status: null, recipient_count: 1, sent_count: 1, failed_count: 0 });
  await run();
  expect(mocks.push).toHaveBeenCalledTimes(1);
});
it('奪えなければ宛先の読み込みも送信もしない', async () => {
  loseClaim = true;
  await run();
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});
it.each(['zero', 'quota'])('0人・残り通数不足は送らず失敗にして1回知らせる: %s', async mode => {
  if (mode === 'zero') mocks.load.mockResolvedValue({ employees: [], tags: [], members: [] });
  else mocks.quota.mockResolvedValue({ remaining: 0 });
  await run();
  await run();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(rows[0].schedule_status).toBe('failed');
  expect(rows[0].sent_at).toBeUndefined();
  expect(mocks.notice).toHaveBeenCalledTimes(1);
  expect(mocks.notice.mock.calls[0][0]).toContain('予約した題名');
});
it('一部失敗は結果と送信日時を保存して1回知らせる', async () => {
  rows[0].tag_ids = [];
  mocks.load.mockResolvedValue({ employees: Array.from({ length: 501 }, (_, index) => person(String(index))), tags: [], members: [] });
  mocks.push.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failure'));
  await run();
  expect(rows[0]).toMatchObject({ sent_count: 500, failed_count: 1, schedule_status: null });
  expect(rows[0].sent_at).toBeTruthy();
  expect(mocks.notice).toHaveBeenCalledTimes(1);
});
it('30分以上止まった送信を失敗にし再送しない', async () => {
  rows[0].schedule_status = 'sending';
  await run();
  await run();
  expect(rows[0].schedule_status).toBe('failed');
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.notice).toHaveBeenCalledTimes(1);
});
it.each(['scheduleUpdate', 'scheduleCancel'])('送信中の予約は変更・取り消し不可: %s', async action => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
  rows[0].schedule_status = 'sending';
  await expect(manageSchedule({ action, id: 'one', title: '変更', body: '文', tagIds: [],
    scheduledAt: '2026-11-05T09:00:00+09:00' }, 'actor')).rejects.toThrow('送信中のため変更できません。');
  expect(rows[0].schedule_status).toBe('sending');
});

it('予約を変更した人を記録し、取り消しても行を残す', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
  await manageSchedule({ action: 'scheduleUpdate', id: 'one', title: '変更した題名',
    body: '変更した本文', tagIds: [], scheduledAt: '2026-11-05T10:00:00+09:00' }, 'editor');
  expect(rows[0]).toMatchObject({ title: '変更した題名', body: '変更した本文',
    updated_by: 'editor', scheduled_at: '2026-11-05T01:00:00.000Z', schedule_status: 'scheduled' });
  await manageSchedule({ action: 'scheduleCancel', id: 'one' }, 'cancel-editor');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ schedule_status: 'canceled', updated_by: 'cancel-editor' });
});
