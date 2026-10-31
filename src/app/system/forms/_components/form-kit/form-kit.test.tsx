import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormPage, FormRow, RadioGroup, SelectField, Stepper, TextField, NumberField, TextArea, FixedValue, SubmitButton, ResultMessage, RecentList } from './index';

afterEach(cleanup);

describe('form-kit', () => {
  it('renders the desktop frame with breadcrumb, sender, tabs and actions', () => {
    render(<FormPage title="報告" submitterName="本人" employeeNumber="1234" description="入力の案内" tabs={<button>設定</button>}><div>入力欄</div></FormPage>);
    expect(screen.getByRole('navigation', { name: '現在地' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('報告');
    expect(screen.getByText(/送信者\s+本人（1234）/)).toHaveAttribute('data-clarity-mask', 'true');
    expect(screen.getByText('入力の案内')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '設定' })).toBeInTheDocument();
  });
  it('keeps the whole mobile title and masked name without desktop chrome', () => {
    const title = '経費 報告（上田基人 専用）';
    render(<FormPage mobile title={title} submitterName="長い名前の送信者" employeeNumber="1234" tabs={<button>設定</button>}>入力欄</FormPage>);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('長い名前の送信者 さん')).toHaveAttribute('data-clarity-mask', 'true');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この画面の使い方' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '設定' })).not.toBeInTheDocument();
    expect(screen.queryByText(/1234/)).not.toBeInTheDocument();
  });
  it('renders a numbered row with an associated input label', () => {
    render(<FormRow label={<label htmlFor="detail">6 用途の詳細</label>}><TextField id="detail" /></FormRow>);
    expect(screen.getByRole('heading', { name: '6 用途の詳細' })).toBeInTheDocument();
    expect(screen.getByLabelText('6 用途の詳細')).toBeInTheDocument();
  });
  it('changes radio selection', () => {
    function Example() { const [value, setValue] = useState('あり'); return <RadioGroup label="交通費" name="transport" options={['あり', 'なし']} value={value} onChange={setValue} />; }
    render(<Example />);
    fireEvent.click(screen.getByRole('radio', { name: 'なし' }));
    expect(screen.getByRole('radio', { name: 'なし' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'あり' })).not.toBeChecked();
  });
  it('starts select with the prompt and passes changes', () => {
    const change = vi.fn();
    render(<SelectField aria-label="事業" defaultValue="" onChange={change}><option value="NHK">NHK</option></SelectField>);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('選んでください');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NHK' } });
    expect(change).toHaveBeenCalledOnce();
  });
  it('increments, decrements and accepts direct counts without going below zero', () => {
    function Example() { const [value, setValue] = useState(0); return <Stepper label="地上" value={value} onChange={setValue} />; }
    render(<Example />);
    const input = screen.getByRole('spinbutton', { name: '地上の件数' });
    fireEvent.click(screen.getByRole('button', { name: '地上を減らす' }));
    expect(input).toHaveValue(0);
    fireEvent.click(screen.getByRole('button', { name: '地上を増やす' }));
    expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '地上を減らす' }));
    expect(input).toHaveValue(6);
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input).toHaveValue(0);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(0);
  });
  it('passes text field input and native validation', () => {
    const change = vi.fn(); render(<TextField aria-label="詳細" required onChange={change} />);
    expect(screen.getByRole('textbox')).toBeRequired();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '帰宅' } });
    expect(change).toHaveBeenCalledOnce();
  });
  it('shows the numeric keyboard hint and unit without coercing empty input', () => {
    render(<NumberField aria-label="金額" unit="円（税込）" defaultValue="" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('円（税込）')).toBeInTheDocument();
  });
  it('passes multiline text changes', () => {
    const change = vi.fn(); render(<TextArea aria-label="備考" onChange={change} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '一行目\n二行目' } });
    expect(change).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toHaveValue('一行目\n二行目');
  });
  it('renders a fixed value as text', () => {
    render(<FixedValue>対面アプローチ</FixedValue>);
    expect(screen.getByText('対面アプローチ', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('blocks clicks while busy and restores the submit label', () => {
    const click = vi.fn(); const { rerender } = render(<SubmitButton busy={false} onClick={click}>送信する</SubmitButton>);
    fireEvent.click(screen.getByRole('button')); expect(click).toHaveBeenCalledOnce();
    rerender(<SubmitButton busy onClick={click}>送信する</SubmitButton>);
    expect(screen.getByRole('button', { name: '送信中...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button')); expect(click).toHaveBeenCalledOnce();
    rerender(<SubmitButton busy={false} onClick={click}>送信する</SubmitButton>);
    expect(screen.getByRole('button', { name: '送信する' })).toBeEnabled();
  });
  it('uses distinct success and error styles and hides empty messages', () => {
    const { rerender } = render(<ResultMessage success>送信しました</ResultMessage>);
    const successClass = screen.getByRole('status').className;
    rerender(<ResultMessage>確認してください</ResultMessage>);
    expect(screen.getByRole('status').className).not.toBe(successClass);
    rerender(<ResultMessage>{''}</ResultMessage>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows empty history, individual report rows or desktop content', () => {
    const { rerender } = render(<RecentList items={[]} />);
    expect(screen.getByText('まだありません')).toBeInTheDocument();
    rerender(<RecentList items={[<p key="1">報告1</p>, <p key="2">報告2</p>]} />);
    expect(screen.getByText('報告1')).toBeInTheDocument(); expect(screen.getByText('報告2')).toBeInTheDocument();
    rerender(<RecentList><div>報告一覧</div></RecentList>);
    expect(screen.getByText('報告一覧')).toBeInTheDocument();
    expect(screen.queryByText('まだありません')).not.toBeInTheDocument();
  });
});