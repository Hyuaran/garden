import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import ScheduledBroadcasts, { ScheduleMode } from './ScheduledBroadcasts';
import type { ScheduledBroadcast } from '@/lib/line/scheduled';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const data = { tags: [], employees: [], members: [] };
const row: ScheduledBroadcast = {
  id: 'reservation', title: '予約の連絡', body: '予約の本文', tag_ids: [],
  scheduled_at: '2026-11-10T01:00:00Z', schedule_status: 'scheduled',
  schedule_error: null, created_by: 'actor', created_by_name: '予約した人', updated_at: '',
};

it('予約選択・日時の確認・保存・完了の幕と入力リセット', async () => {
  const act = vi.fn().mockResolvedValue({ ok: true });
  const reset = vi.fn();
  function Harness() {
    const [enabled, setEnabled] = useState(false);
    return <ScheduleMode draft={{ title: '題名', body: '本文', tagIds: [] }} data={data}
      busy={false} enabled={enabled} onModeChange={setEnabled} onReset={reset} onError={vi.fn()} act={act} />;
  }
  render(<Harness />);
  expect(screen.queryByRole('button', { name: '予約する' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '日時を指定して予約' }));
  expect(screen.getByLabelText('送信時刻').querySelectorAll('option[value]:not([value=""])')).toHaveLength(72);
  fireEvent.click(screen.getByRole('button', { name: '予約する' }));
  const dialog = screen.getByRole('dialog', { name: '送信の確認' });
  expect(within(dialog).getByText('送信日時')).toBeInTheDocument();
  expect(within(dialog).getByText('送信する時点の人に送ります。今の時点で0人')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '予約する' }));
  expect(await screen.findByRole('status')).toHaveTextContent('に予約しました');
  expect(act).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule', title: '題名', body: '本文', tagIds: [] }));
  expect(reset).toHaveBeenCalledTimes(1);
});

it('予約で題名が空なら、知らせを親に渡して小窓を開かない', () => {
  const onError = vi.fn();
  render(<ScheduleMode draft={{ title: '', body: '本文', tagIds: [] }} data={data}
    busy={false} enabled onModeChange={vi.fn()} onReset={vi.fn()} onError={onError} act={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '予約する' }));
  expect(onError).toHaveBeenCalledWith('題名・送信内容を入力してください。');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('予定の行から題名・内容・日時を変更して保存できる', async () => {
  const act = vi.fn().mockResolvedValue({ ok: true });
  render(<ScheduledBroadcasts data={{ ...data, scheduled: [{ ...row,
    scheduled_at: new Date(Date.now() + 86400_000).toISOString().slice(0, 10) + 'T01:00:00Z' }] }} busy={false} act={act} />);
  fireEvent.click(screen.getByText(row.title));
  const dialog = screen.getByRole('dialog', { name: '送信予定の変更' });
  fireEvent.change(within(dialog).getByLabelText('予約の題名'), { target: { value: '変更した題名' } });
  fireEvent.change(within(dialog).getByLabelText('予約の送信内容'), { target: { value: '変更した本文' } });
  fireEvent.change(within(dialog).getByLabelText('送信時刻'), { target: { value: '10:20' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '保存する' }));
  expect(act).toHaveBeenCalledWith(expect.objectContaining({ action: 'scheduleUpdate', id: row.id, title: '変更した題名', body: '変更した本文' }));
});

it('ごみ箱からGardenの小窓で確認して取り消す', async () => {
  const act = vi.fn().mockResolvedValue({ ok: true });
  render(<ScheduledBroadcasts data={{ ...data, scheduled: [row] }} busy={false} act={act} />);
  fireEvent.click(screen.getByText(row.title));
  fireEvent.click(screen.getByRole('button', { name: '予約を取り消す' }));
  expect(act).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog', { name: '予約の取り消し' });
  fireEvent.click(within(dialog).getByRole('button', { name: '予約を取り消す' }));
  expect(act).toHaveBeenCalledWith({ action: 'scheduleCancel', id: row.id });
});

it('失敗した予約は理由を表示し、0件なら一覧を出さない', () => {
  const { rerender } = render(<ScheduledBroadcasts data={{ ...data, scheduled: [{ ...row,
    schedule_status: 'failed', schedule_error: '今月の残り通数が足りません。' }] }} busy={false} act={vi.fn()} />);
  expect(screen.getByText('送信できませんでした：今月の残り通数が足りません。')).toBeInTheDocument();
  rerender(<ScheduledBroadcasts data={data} busy={false} act={vi.fn()} />);
  expect(screen.queryByText(/送信予定（/)).toBeNull();
});
