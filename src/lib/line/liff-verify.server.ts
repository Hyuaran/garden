import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { statusOf } from '@/lib/line/tags';
export async function verifyLiffEmployee(idToken: unknown, purpose?: 'forms') {
  const liffId = purpose === 'forms' ? process.env.NEXT_PUBLIC_LIFF_FORMS_ID : (process.env.NEXT_PUBLIC_LIFF_SHIFT_ID || process.env.NEXT_PUBLIC_LIFF_FORMS_ID);
  // LIFF ID prefix is the LINE Login channel ID, not the Messaging API channel.
  const clientId = liffId?.split('-')[0];
  if (!clientId || !/^\d+$/.test(clientId) || typeof idToken !== 'string' || !idToken || idToken.length > 10000) return NextResponse.json({}, { status: 401 });
  let verified;
  try {
    const r = await fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id_token: idToken, client_id: clientId }), cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!r.ok) return NextResponse.json({}, { status: 401 });
    verified = await r.json();
    if (typeof verified.sub !== 'string' || verified.iss !== 'https://access.line.me' || verified.aud !== clientId || typeof verified.exp !== 'number' || verified.exp <= Date.now()/1000) return NextResponse.json({}, { status: 401 });
  } catch { return NextResponse.json({}, { status: 401 }); }
  const { data, error } = await getSupabaseAdmin().from('root_employees').select('employee_id,employee_number,name,company_id,is_active,hire_date,termination_date,line_link_source').eq('line_user_id', verified.sub).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: '確認できませんでした。時間をおいてもう一度お試しください。' }, { status: 503 });
  if (!data || data.line_link_source === 'unfollowed' || statusOf(data as unknown as Parameters<typeof statusOf>[0]) === '退職') return NextResponse.json({ error: 'この画面は従業員の方だけが使えます' }, { status: 403 });
  return data;
}
