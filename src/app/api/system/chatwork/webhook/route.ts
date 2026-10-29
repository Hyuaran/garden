import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ChatworkClient } from '@/lib/chatwork/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function cleanBody(body: string) {
  return body.replace(/^[ \t]*\[To:\d+\][^\r\n]*/gm, '')
    .replace(/\[rp\s+aid=[^\]]+\][^\r\n]*/g, '')
    .replace(/\[\/?(?:info|title)\]/g, '').trim();
}

function retryKey(messageId: string, target: string) {
  const bytes = createHash('sha256').update(JSON.stringify([messageId, target])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function POST(request: Request) {
  const secret = process.env.CHATWORK_WEBHOOK_TOKEN;
  if (!secret) return Response.json({}, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get('x-chatworkwebhooksignature')
    ?? new URL(request.url).searchParams.get('chatwork_webhook_signature');
  const expected = createHmac('sha256', Buffer.from(secret, 'base64')).update(raw).digest('base64');
  const received = Buffer.from(signature ?? '');
  if (received.length !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(expected), received)) {
    return Response.json({}, { status: 401 });
  }
  let payload;
  try { payload = JSON.parse(raw); } catch { return Response.json({}, { status: 400 }); }
  if (payload?.webhook_event_type !== 'mention_to_me') return Response.json({ ok: true });
  const event = payload.webhook_event;
  const id = (value: unknown) => (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value));
  if (!event || !['from_account_id', 'to_account_id', 'room_id', 'message_id'].every(key => id(event[key])) || typeof event.body !== 'string') {
    return Response.json({}, { status: 400 });
  }
  if (String(event.from_account_id) === String(event.to_account_id)) return Response.json({ ok: true });
  const body = cleanBody(event.body);
  if (!body) return Response.json({ ok: true });
  try {
    const db = getSupabaseAdmin();
    const targets = await db.from('system_line_target').select('line_target_id')
      .eq('chatwork_room_id', String(event.room_id)).eq('account', 'dev').eq('active', true)
      .not('linked_at', 'is', null).not('line_target_id', 'is', null).in('target_type', ['group', 'room']);
    if (targets.error) throw targets.error;
    if (!targets.data?.length) return Response.json({ ok: true });
    // Claim before any external request: concurrent webhook redeliveries cannot push twice.
    const claim = await db.from('system_chatwork_line_forward').insert({
      message_id: String(event.message_id), room_id: String(event.room_id),
      from_account_id: String(event.from_account_id), status: 'skipped',
    });
    if (claim.error?.code === '23505') return Response.json({ ok: true });
    if (claim.error) throw claim.error;
    let name = '（名前を取得できませんでした）';
    try {
      if (process.env.CHATWORK_API_TOKEN) {
        const response = await fetch(`https://api.chatwork.com/v2/rooms/${event.room_id}/members`, {
          headers: { 'X-ChatWorkToken': process.env.CHATWORK_API_TOKEN },
        });
        if (response.ok) {
          const members: { account_id: number; name: string }[] = await response.json();
          name = members.find(member => String(member.account_id) === String(event.from_account_id))?.name || name;
        }
      }
    } catch { /* Forward even if the member lookup fails. */ }
    const text = `${name}：${body}`.slice(0, 5000);
    const failures: string[] = [];
    for (const target of targets.data) {
      let error: string | null = null;
      try {
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) throw new Error('LINE のトークンが未設定です');
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
            'X-Line-Retry-Key': retryKey(String(event.message_id), target.line_target_id) },
          body: JSON.stringify({ to: target.line_target_id, messages: [{ type: 'text', text }] }),
        });
        if (!response.ok && !(response.status === 409 && response.headers.get('x-line-accepted-request-id'))) {
          throw new Error(`LINE HTTP ${response.status}`);
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message.replace(/[\r\n]+/g, ' ').slice(0, 200) : '通信エラー';
        failures.push(error);
      }
      const result = await db.from('system_chatwork_line_forward_delivery').insert({
        message_id: String(event.message_id), line_target_id: target.line_target_id,
        status: error ? 'failed' : 'sent', error,
      });
      if (result.error) throw result.error;
    }
    const result = await db.from('system_chatwork_line_forward').update({
      line_target_id: targets.data[0].line_target_id, status: failures.length ? 'failed' : 'sent',
      error: failures.length ? [...new Set(failures)].join('／') : null,
    }).eq('message_id', String(event.message_id));
    if (result.error) throw result.error;
    if (failures.length) {
      await new ChatworkClient(process.env.CHATWORK_API_TOKEN ?? '', {
        dryRun: ['true', '1', 'yes'].includes((process.env.BLOOM_CHATWORK_DRY_RUN ?? '').trim().toLowerCase()),
      }).sendMessage(String(event.room_id), `LINE へ送れませんでした（${[...new Set(failures)].join('／')}）`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({}, { status: 500 });
  }
}
