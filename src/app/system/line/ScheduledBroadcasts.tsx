'use client';

import { useState } from 'react';
import { recipients, kindLabels, type Employee, type Tag, type Member } from '@/lib/line/tags';
import { scheduleTimes, scheduleDateLabel, validateScheduledAt, type ScheduledBroadcast } from '@/lib/line/scheduled';
import Modal from '../_components/Modal/Modal';
import DoneOverlay from '../_components/DoneOverlay/DoneOverlay';
import RowActionButton from '../_components/RowActionButton/RowActionButton';
import DataTable from '../_components/DataTable/DataTable';
import BoxSelect from '../_components/BoxSelect/BoxSelect';
import { RadioGroup, FormRow, TextField, TextArea, SelectField, SubmitButton, FixedValue, ResultMessage } from '../forms/_components/form-kit';
import styles from './ScheduledBroadcasts.module.css';

type Draft = { title: string; body: string; tagIds: string[] };
type Props = {
  draft: Draft;
  data: { tags: Tag[]; employees: Employee[]; members: Member[]; scheduled?: ScheduledBroadcast[] };
  busy: boolean;
  message?: string;
  enabled: boolean;
  onModeChange: (enabled: boolean) => void;
  onReset: () => void;
  act: (payload: object, refresh?: boolean) => Promise<unknown>;
};

function initialDate() {
  return new Date(Date.now() + 24 * 3600_000 + 9 * 3600_000).toISOString().slice(0, 10);
}

function DateFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [date = '', time = '09:00'] = value.split('T');
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 220px))', gap: 12 }}>
    <TextField type="date" aria-label="送信日" value={date} onChange={event => onChange(`${event.target.value}T${time}`)} />
    <SelectField aria-label="送信時刻" value={time} onChange={event => onChange(`${date}T${event.target.value}`)}>
      {scheduleTimes.map(item => <option key={item} value={item}>{item}</option>)}
    </SelectField>
  </div>;
}

export function ScheduleEditor({ row, tags, busy, act, onClose, message }: {
  row: ScheduledBroadcast; tags: Tag[]; busy: boolean;
  message?: string;
  act: Props['act']; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ title: row.title, body: row.body, tagIds: row.tag_ids });
  const [date, setDate] = useState(new Date(new Date(row.scheduled_at).getTime() + 9 * 3600_000).toISOString().slice(0, 16));
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState('');
  const locked = row.schedule_status === 'sending';
  return <>
    <Modal className={styles.modal} title="送信予定の変更" onClose={onClose} actions={<>
      <RowActionButton kind="delete" label="予約を取り消す" disabled={busy || locked} onClick={() => setCancel(true)} />
      <SubmitButton busy={busy} disabled={locked} onClick={async () => {
        try {
          const scheduledAt = validateScheduledAt(`${date}:00+09:00`);
          if (await act({ action: 'scheduleUpdate', id: row.id, ...draft, scheduledAt })) onClose();
        } catch (cause) { setError((cause as Error).message); }
      }}>保存する</SubmitButton>
    </>}>
      {error && <ResultMessage>{error}</ResultMessage>}
      {message && <ResultMessage>{message}</ResultMessage>}
      {locked && <p>送信中のため変更できません。</p>}
      {row.schedule_error && <p>送信できませんでした：{row.schedule_error}</p>}
      <FormRow label="題名"><TextField aria-label="予約の題名" maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></FormRow>
      <FormRow label="送信内容"><TextArea aria-label="予約の送信内容" maxLength={5000} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} /></FormRow>
      <FormRow label="絞り込み"><BoxSelect label="予約の絞り込み" value={draft.tagIds} options={tags.map(tag => ({ value: tag.id, label: `${kindLabels[tag.kind]}：${tag.name}` }))} onChange={tagIds => setDraft({ ...draft, tagIds })} /></FormRow>
      <FormRow label="送信日時"><DateFields value={date} onChange={setDate} /></FormRow>
      <p>指定の時刻から最大5分ほど遅れて送信されます。</p>
    </Modal>
    {cancel && <Modal title="予約の取り消し" onClose={() => setCancel(false)} actions={
      <SubmitButton busy={busy} onClick={async () => {
        if (await act({ action: 'scheduleCancel', id: row.id })) onClose();
      }}>予約を取り消す</SubmitButton>
    }>{message && <ResultMessage>{message}</ResultMessage>}<p>「{row.title}」の予約を取り消しますか？</p></Modal>}
  </>;
}

export function ScheduleMode({ draft, data, busy, enabled, onModeChange, onReset, act, message }: Props) {
  const [date, setDate] = useState(`${initialDate()}T09:00`);
  const [confirm, setConfirm] = useState<string>();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const people = recipients(data.employees, draft.tagIds, data.tags, data.members);
  return <>
    <RadioGroup
      name="send-mode"
      label="送信のしかた"
      options={['今すぐ送信', '日時を指定して予約']}
      value={enabled ? '日時を指定して予約' : '今すぐ送信'}
      onChange={value => onModeChange(value === '日時を指定して予約')}
    />
    {enabled && <FormRow label="送信日時">
      <DateFields value={date} onChange={setDate} />
      <p>指定の時刻から最大5分ほど遅れて送信されます。</p>
    </FormRow>}
    {enabled && <>
      {error && <ResultMessage>{error}</ResultMessage>}
      <SubmitButton busy={busy} onClick={() => {
        try {
          if (!draft.title.trim() || !draft.body.trim()) throw new Error('題名・送信内容を入力してください。');
          setConfirm(validateScheduledAt(`${date}:00+09:00`));
          setError('');
        } catch (cause) { setError((cause as Error).message); }
      }}>確認する</SubmitButton>
    </>}
    {confirm && <Modal title="送信の確認" onClose={() => setConfirm(undefined)} actions={
      <SubmitButton busy={busy} onClick={async () => {
        if (!await act({ action: 'schedule', ...draft, scheduledAt: confirm })) return;
        setDone(`${scheduleDateLabel(confirm)} に予約しました`);
        setConfirm(undefined);
        onReset();
        window.setTimeout(() => setDone(''), 1800);
      }}>予約する</SubmitButton>
    }>
      {message && <ResultMessage>{message}</ResultMessage>}
      <FormRow label="送信日時"><FixedValue>{scheduleDateLabel(confirm)}</FixedValue></FormRow>
      <FormRow label="人数"><FixedValue>送信する時点の人に送ります。今の時点で{people.length}人</FixedValue></FormRow>
      <FormRow label="送信先"><FixedValue>{draft.tagIds.map(id => data.tags.find(tag => tag.id === id)?.name).filter(Boolean).join('、') || '全員'}</FixedValue></FormRow>
      <FormRow label="題名"><FixedValue>{draft.title}</FixedValue></FormRow>
      <FormRow label="送信内容"><FixedValue><span style={{ whiteSpace: 'pre-wrap' }}>{draft.body}</span></FixedValue></FormRow>
    </Modal>}
    {done && <DoneOverlay title={done} />}
  </>;
}

export default function ScheduledBroadcasts({ data, busy, act, message }: Pick<Props, 'data' | 'busy' | 'act' | 'message'>) {
  const [edit, setEdit] = useState<ScheduledBroadcast>();
  const rows = data.scheduled ?? [];
  if (!rows.length) return null;
  return <>
    <h2>送信予定（{rows.length}件）</h2>
    <DataTable rows={rows} rowKey={row => row.id} onRowClick={setEdit}
      searchText={row => row.title} defaultSort={{ id: 'date', direction: 'asc' }} columns={[
      { id: 'date', label: '送信日時', type: 'text', value: row => scheduleDateLabel(row.scheduled_at, true) },
      { id: 'title', label: '題名', type: 'text', value: row => row.title },
      { id: 'tags', label: '送信先', type: 'text', value: row => row.tag_ids.map(id => data.tags.find(tag => tag.id === id)?.name).filter(Boolean).join('、') || '全員' },
      { id: 'creator', label: '予約した人', type: 'text', value: row => row.created_by_name ?? '不明' },
      { id: 'state', label: '状態', type: 'text', value: row => row.schedule_status === 'failed' ? `送信できませんでした：${row.schedule_error}` : row.schedule_status === 'sending' ? '送信中' : '送信予定' },
    ]} />
    {edit && <ScheduleEditor row={edit} tags={data.tags} busy={busy} act={act} message={message} onClose={() => setEdit(undefined)} />}
  </>;
}
