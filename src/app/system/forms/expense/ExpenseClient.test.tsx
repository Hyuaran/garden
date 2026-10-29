import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/app/system/_components/DataTable/DataTable', () => ({ default: () => <div>報告一覧</div> }));
import ExpenseClient from './ExpenseClient';
const report = { id: '1', form: 'nhk-kanden', business: '関電', payment: '現金', paid_on: '2026-10-29', amount: 430, purpose: '交通費', purpose_detail: '帰宅', note: '', created_at: '2026-10-29T01:19:00Z' };
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/m/expense'); vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ reports: [report] })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('ExpenseClient', () => {
  it('changes businesses by tab, hides NHK selection, remembers URL and storage', async () => {
    render(<ExpenseClient submitterName="本人" employeeNumber="1508" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText('NHK', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '関電・NHK' }));
    expect(screen.getByRole('radio', { name: '関電' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'ブレーカー' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '上田基人 専用' }));
    expect(screen.getByRole('option', { name: 'ブレーカー' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '関電' })).not.toBeInTheDocument();
    expect(window.location.search).toBe('?form=ueda'); expect(localStorage.getItem('expense-form:1508')).toBe('ueda');
  });
  it('fills three reused values, blocks duplicate submission and resets only requested fields', async () => {
    window.history.replaceState(null, '', '/m/expense?form=nhk-kanden');
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(async (_url, init) => init?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : Response.json({ reports: [report] }));
    render(<ExpenseClient submitterName="本人" employeeNumber="1508" />);
    await waitFor(() => expect(screen.getByRole('radio', { name: '関電' })).toBeChecked());
    fireEvent.change(screen.getByLabelText('よく使う入力から選ぶ'), { target: { value: '0' } });
    expect(screen.getByLabelText('金額（円・税込）')).toHaveValue('430'); expect(screen.getByLabelText('用途の詳細')).toHaveValue('帰宅'); expect(screen.getByRole('radio', { name: '交通費' })).toBeChecked();
    fireEvent.change(screen.getByLabelText('備考'), { target: { value: '備考あり' } });
    const date = (screen.getByLabelText('決済日') as HTMLInputElement).value;
    fireEvent.click(screen.getByRole('button', { name: '報告内容を送信する' }));
    expect(screen.getByRole('button', { name: '送信中...' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: '送信中...' }).closest('form')!);
    expect(fetch).toHaveBeenCalledTimes(2);
    finish(Response.json({ ok: true, report }));
    await screen.findByText('送信しました');
    expect(screen.getByLabelText('金額（円・税込）')).toHaveValue(''); expect(screen.getByLabelText('用途の詳細')).toHaveValue(''); expect(screen.getByLabelText('備考')).toHaveValue('');
    expect(screen.getByLabelText('決済日')).toHaveValue(date); expect(screen.getByRole('radio', { name: '関電' })).toBeChecked(); expect(screen.getByRole('radio', { name: '現金' })).toBeChecked();
  });
});

it('shows seven mobile rows, sender and one submit without tabs or a table', async () => {
  render(<ExpenseClient submitterName="本人" employeeNumber="1508" fixedForm="nhk-kanden" />);
  await screen.findByLabelText('よく使う入力から選ぶ');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('経費 報告（関電・NHK）');
  expect(screen.getByText('本人 さん')).toBeInTheDocument();
  expect(screen.queryByText(/1508/)).not.toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).filter(h => /^[1-7] /.test(h.textContent ?? ''))).toHaveLength(7);
  expect(screen.getAllByRole('button', { name: '送信する' })).toHaveLength(1);
  expect(screen.queryByText('報告一覧')).not.toBeInTheDocument();
  expect(screen.getByText(/2026-10-29.*430 円/)).toBeInTheDocument();
});
it('hides the entire reuse field when there are no candidates', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ reports: [], combinations: [] }));
  render(<ExpenseClient submitterName="本人" employeeNumber="1508" fixedForm="nhk" />);
  await screen.findByText('まだありません');
  expect(screen.queryByLabelText('よく使う入力から選ぶ')).not.toBeInTheDocument();
  expect(screen.queryByText('選ぶと、使用用途・用途の詳細・金額がまとめて入ります')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
