// @vitest-environment node
import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock('@/lib/chatwork/client', () => ({ ChatworkClient: class { sendMessage = mocks.send; } }));
let targets: Record<string, unknown>[];
let records: Record<string, unknown>[];
let deliveries: Record<string, unknown>[];
let fetchMock: ReturnType<typeof vi.fn>;
let pushStatus: number;

function request(overrides: Record<string, unknown> = {}, mode = 'header') {
  const raw = JSON.stringify({ webhook_event_type: 'mention_to_me', webhook_event: {
    from_account_id: 1, to_account_id: 2, room_id: 3, message_id: '4',
    body: '[To:2]通知さん\n[rp aid=2 to=3-4]通知さん\n[info][title]件名[/title]\n本文[/info]',
  }, ...overrides });
  const signature = createHmac('sha256', Buffer.from('secret')).update(raw).digest('base64');
  return new Request(`https://example.test/api/system/chatwork/webhook${mode === 'query' ? `?chatwork_webhook_signature=${encodeURIComponent(signature)}` : ''}`, {
    method: 'POST', body: raw, headers: mode === 'query' ? {} : { 'x-chatworkwebhooksignature': mode === 'bad' ? 'bad' : signature },
  });
}

beforeEach(() => {
  vi.stubEnv('CHATWORK_WEBHOOK_TOKEN', Buffer.from('secret').toString('base64'));
  vi.stubEnv('CHATWORK_API_TOKEN', 'chatwork-test');
  vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'line-test');
  targets = [{ line_target_id: 'group1', account: 'dev', active: true, linked_at: 'today', target_type: 'group', chatwork_room_id: '3' }];
  records = []; deliveries = []; pushStatus = 200;
  mocks.send.mockReset().mockResolvedValue({ message_id: '5' });
  mocks.admin.mockImplementation(() => ({ from(table: string) {
    let data = targets;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { data = data.filter(row => row[key] === value); return query; },
      not: (key: string) => { data = data.filter(row => row[key] != null); return query; },
      in: (key: string, values: unknown[]) => { data = data.filter(row => values.includes(row[key])); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      insert: async (row: Record<string, unknown>) => {
        if (table === 'system_chatwork_line_forward') {
          if (records.some(existing => existing.message_id === row.message_id)) return { error: { code: '23505' } };
          records.push(row);
        } else deliveries.push(row);
        return { error: null };
      },
      update: (row: Record<string, unknown>) => ({ eq: async () => { Object.assign(records[0], row); return { error: null }; } }),
    };
    return query;
  } }));
  fetchMock = vi.fn(async (url: string) => url.includes('/members')
    ? Response.json([{ account_id: 1, name: '太郎' }])
    : new Response('', { status: pushStatus }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Chatwork to LINE webhook', () => {
  it('rejects invalid signatures and missing configuration', async () => {
    expect((await POST(request({}, 'bad'))).status).toBe(401);
    vi.stubEnv('CHATWORK_WEBHOOK_TOKEN', '');
    expect((await POST(request())).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each(['header', 'query'])('accepts %s signature, removes markup, and deduplicates', async mode => {
    expect((await POST(request({}, mode))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('forwards cleaned text once and uses a stable UUID per destination', async () => {
    await POST(request());
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[1][1];
    expect(JSON.parse(init.body as string)).toEqual({ to: 'group1', messages: [{ type: 'text', text: '太郎：件名\n本文' }] });
    expect((init.headers as Record<string,string>)['X-Line-Retry-Key']).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    await POST(request());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records[0].status).toBe('sent');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('ignores other event types and self messages', async () => {
    await POST(request({ webhook_event_type: 'message_created' }));
    await POST(request({ webhook_event: { from_account_id: 2, to_account_id: 2, room_id: 3, message_id: 4, body: '本文' } }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not send a body containing only mention markup', async () => {
    await POST(request({ webhook_event: { from_account_id: 1, to_account_id: 2, room_id: 3, message_id: 4, body: '[To:2]通知さん\n[info][/info]' } }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('claims concurrent redeliveries before pushing', async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
  });
  it.each(['official', 'unlinked', 'inactive', 'other-room', 'empty'])('does not send to %s destinations', async kind => {
    if (kind === 'official') targets[0].account = 'official';
    if (kind === 'unlinked') targets[0].linked_at = null;
    if (kind === 'inactive') targets[0].active = false;
    if (kind === 'other-room') targets[0].chatwork_room_id = '99';
    if (kind === 'empty') targets = [];
    expect((await POST(request())).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends all linked groups and records individual failures with one Chatwork reply', async () => {
    targets.push({ ...targets[0], line_target_id: 'group2' });
    pushStatus = 500;
    expect((await POST(request())).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every(row => row.status === 'failed')).toBe(true);
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith('3', 'LINE へ送れませんでした（LINE HTTP 500）');
  });
  it('uses fallback name and truncates LINE text to 5000 characters', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await POST(request({ webhook_event: { from_account_id: 1, to_account_id: 2, room_id: 3, message_id: 4, body: 'あ'.repeat(6000) } }));
    const text = JSON.parse((fetchMock.mock.calls as unknown as [string, RequestInit][])[1][1].body as string).messages[0].text;
    expect(text).toHaveLength(5000);
    expect(text).toMatch(/^（名前を取得できませんでした）：/);
  });
});
