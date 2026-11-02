import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TextField } from './root/_components/FormField';
import { RillComposePane } from './rill/mail/_components/RillComposePane';
import { validateComposeInput } from './rill/mail/_lib/compose';

afterEach(cleanup);

it('Root switches the visible and accessible required state together', () => {
  const { container, rerender } = render(<TextField label="銀行名" required />);
  expect(container.querySelector('.garden-required')).toHaveTextContent('＊');
  expect(screen.getByRole('textbox', { name: '銀行名' })).toHaveAttribute('aria-required', 'true');
  rerender(<TextField label="銀行名" required={false} />);
  expect(container.querySelector('.garden-required')).toBeNull();
  expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-required');
});

it('Rill marks the recipients and subject but keeps Cc and empty body optional', () => {
  const draft = { id: 'draft', mode: 'new' as const, box: 'inbox', to: ['a@example.com'], cc: [], subject: '件名', bodyText: '', quote: '', fromLabel: '自分', ccVisible: true, attachments: [] };
  const noop = vi.fn();
  const { container } = render(<RillComposePane draft={draft} addresses={[]} error="" onChange={noop} onSend={noop} onMinimize={noop} onClose={noop} onDiscard={noop} />);
  expect(container.querySelectorAll('.garden-required')).toHaveLength(2);
  expect(screen.getByRole('combobox', { name: '宛先' })).toHaveAttribute('aria-required', 'true');
  expect(screen.getByRole('textbox', { name: '件名' })).toHaveAttribute('aria-required', 'true');
  expect(validateComposeInput(draft).bodyText).toBe('');
  expect(() => validateComposeInput({ ...draft, subject: '' })).toThrow('件名を入力してください');
});

it('Leaf keeps alternative attachments grouped and marks required backoffice fields outside search mode', () => {
  const input = readFileSync('src/app/leaf/_templates/input.html', 'utf8');
  const backoffice = readFileSync('src/app/leaf/_templates/backoffice.html', 'utf8');
  expect(input).toContain('電灯・動力・ガスのいずれか必須');
  expect(input).toContain('関電お客様番号（14桁）を入力<span class="garden-required" aria-hidden="true">＊</span>');
  expect(backoffice).toContain('required && !searchMode');
  expect(backoffice).toContain('<span class="garden-required" aria-hidden="true">＊</span>');
});

it.each([
  ['System / mobile', 'src/app/system/forms/nhk-visit/NhkVisitClient.tsx', '<FormRow required label={<>1 日付</>}'],
  ['Bud', 'src/app/bud/bank/BankAccounts.tsx', '起点の時刻（日本時間）<span className="garden-required"'],
  ['My page', 'src/app/my/ApDailyReport.tsx', '<FormRow required grouped label="8 反省点・改善点"'],
  ['Partner', 'src/app/p/toss/new/TossForm.tsx', '{meta.required && <span className="garden-required"'],
  ['Login', 'src/app/login/page.tsx', '社員番号またはID<span className="garden-required"'],
])('%s retains required markers on its main form', (_module, file, expected) => {
  expect(readFileSync(file, 'utf8')).toContain(expected);
});
