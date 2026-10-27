import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ admin: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn(), is: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: m.admin }));
import { chatworkToLine } from '@/lib/chatwork/mentions.server';
beforeEach(() => {
  vi.resetAllMocks();
  m.admin.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ select: m.select });
  m.select.mockReturnValue({ in: m.in });
  m.in.mockReturnValue({ is: m.is });
});
it('keeps requested order, skips missing people and deduplicates accounts', async () => {
  m.is.mockResolvedValue({ data: [
    { employee_id: 'EMP-1', chatwork_account_id: '11' },
    { employee_id: 'EMP-2', chatwork_account_id: '22' },
    { employee_id: 'EMP-3', chatwork_account_id: '11' },
    { employee_id: 'EMP-4', chatwork_account_id: null },
  ], error: null });
  expect(await chatworkToLine(['EMP-2','EMP-1','EMP-3','EMP-4','EMP-5','EMP-2']))
    .toEqual({ line: '[To:22][To:11]', missing: ['EMP-4','EMP-5'] });
  expect(m.from).toHaveBeenCalledWith('root_employees');
  expect(m.is).toHaveBeenCalledWith('deleted_at', null);
});
it('returns an empty line without querying for an empty array', async () => {
  expect(await chatworkToLine([])).toEqual({ line: '', missing: [] });
  expect(m.admin).not.toHaveBeenCalled();
});
it('reports query errors instead of silently dropping recipients', async () => {
  m.is.mockResolvedValue({ data: null, error: new Error('database') });
  await expect(chatworkToLine(['EMP-1'])).rejects.toThrow('database');
});