import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ employee: vi.fn(), view: vi.fn(), create: vi.fn(), from: vi.fn() }));
vi.mock('@/app/system/mypage/_lib/submission-server', () => ({ requireEmployee: mocks.employee }));
vi.mock('@/lib/auth/view-permission.server', () => ({ systemViewResponse: mocks.view }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock('@/lib/kintone/records', () => ({ createRecord: mocks.create }));
import { POST, GET } from './route';
const input = { form: 'nhk', business: 'NHK', payment: '現金', paid_on: '2026-10-29', amount: 430, purpose: '交通費', purpose_detail: '', note: '' };
let insert: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, eq: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.view.mockResolvedValue(null); mocks.employee.mockResolvedValue({ userId: 'user-1', employee_number: '1508', name: '本人' });
  insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { ...input, id: 'report-1', created_at: '2026-10-29T01:19:00Z' }, error: null }) }) }));
  eq = vi.fn().mockResolvedValue({ error: null }); update = vi.fn(() => ({ eq })); mocks.from.mockReturnValue({ insert, update });
  vi.stubEnv('KINTONE_SUBDOMAIN', 'test'); vi.stubEnv('KINTONE_EXPENSE_REPORT_TOKEN', 'expense-token'); vi.stubEnv('KINTONE_EMPLOYEE_ROSTER_TOKEN', 'roster-token');
  mocks.create.mockResolvedValue({ id: '99' });
});
afterEach(() => vi.unstubAllEnvs());
const post = (body = {}) => POST(new Request('http://localhost/api/system/expense-report', { method: 'POST', body: JSON.stringify({ ...input, ...body }) }));
describe('expense API (all external dependencies mocked)', () => {
  it('uses authenticated identity and joins both tokens', async () => {
    const response = await post({ employee_number: 'attacker', employee_name: '偽名', submitted_by: 'other' });
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ employee_number: '1508', employee_name: '本人', submitted_by: 'user-1' }));
    expect(mocks.create).toHaveBeenCalledWith('95', 'expense-token,roster-token', expect.objectContaining({ ルックアップ: { value: '1508' } }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ kintone_record_id: '99', kintone_error: null }));
  });
  it('returns 200 and persists Kintone errors', async () => {
    mocks.create.mockRejectedValue(new Error('kintone_503'));
    const response = await post(); expect(response.status).toBe(200);
    expect((await response.json()).kintone_error).toBe('kintone_503');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ kintone_error: 'kintone_503' }));
  });
  it('does not send without configuration', async () => {
    vi.stubEnv('KINTONE_EXPENSE_REPORT_TOKEN', '');
    expect((await (await post()).json()).kintone_error).toBe('Kintone の設定がありません'); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated and invalid input before saving', async () => {
    expect((await post({ amount: 0 })).status).toBe(400); expect(insert).not.toHaveBeenCalled();
    mocks.employee.mockResolvedValue(null); expect((await post()).status).toBe(403);
  });
  it('never sends if Garden save fails', async () => {
    insert.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: {} }) }) });
    expect((await post()).status).toBe(500); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('reads only own recent reports and deduplicates', async () => {
    const order = vi.fn().mockResolvedValue({ data: [input, input], error: null }); const gte = vi.fn(() => ({ order })); const olderLimit = vi.fn().mockResolvedValue({ data: [input, { ...input, amount: 999 }, input], error: null }); const own = vi.fn(() => ({ gte, order: () => ({ limit: olderLimit }) }));
    const latest = { maybeSingle: async () => ({ data: { business: 'NHK' } }) };
    const latestOrder = { limit: () => latest };
    const latestForm = { order: () => latestOrder };
    const latestOwner = { eq: () => latestForm };
    mocks.from.mockReturnValue({ select: (fields: string) => fields === '*' ? { eq: own } : { eq: () => latestOwner } });
    const response = await GET(new Request('http://localhost/api/system/expense-report?recent=1'));
    expect(own).toHaveBeenCalledWith('submitted_by', 'user-1'); expect(gte).toHaveBeenCalledWith('created_at', expect.any(String));
    // 「前と同じ内容」は 1 週間より前も含む新しい 50 件から作る
    expect(olderLimit).toHaveBeenCalledWith(50); expect((await response.json()).combinations).toHaveLength(2);
  });
});
