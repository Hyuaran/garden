import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checked, requireLineAdmin } from '@/lib/line/tags.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
export const runtime = 'nodejs';
export async function GET() {
  if (!await requireLineAdmin()) return NextResponse.json({}, {status:403});
  try {
    const {data} = checked(await getSupabaseAdmin().from('system_line_target').select('id,label,account,chatwork_room_id,notify_enabled,linked_at').eq('active',true).in('account',['dev','official']).in('target_type',['group','room']).order('joined_at'));
    return NextResponse.json({groups:data});
  } catch { return NextResponse.json({error:'グループを読み込めませんでした。'}, {status:500}); }
}
export async function POST(request: Request) {
  if (!await requireLineAdmin()) return NextResponse.json({}, {status:403});
  try {
    const b = await request.json(); const db = getSupabaseAdmin();
    if (b.id && (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id))) throw new Error();
    if (b.action === 'remove' && b.id && b.confirm === true) {
      checked(await db.from('system_line_target').update({active:false,notify_enabled:false,link_code:null,link_code_expires_at:null}).eq('id',b.id));
      return NextResponse.json({ok:true});
    }
    if (!['save','code'].includes(b.action) || typeof b.label !== 'string' || b.label.length > 100 || typeof b.room !== 'string' || (b.room && !/^\d+$/.test(b.room)) || b.room.length > 40 || typeof b.notify !== 'boolean') throw new Error();
    if (!b.id && b.action !== 'code') throw new Error();
    const values = {label:b.label.trim() || null,chatwork_room_id:b.room || null,notify_enabled:b.notify};
    for (let attempt=0; attempt<30; attempt++) {
      const code = b.action === 'code' ? `G-${String(randomInt(10000)).padStart(4,'0')}` : null;
      const row = {...values,...(code ? {link_code:code,link_code_expires_at:new Date(Date.now()+86400000).toISOString()} : {})};
      const result = b.id
        ? await db.from('system_line_target').update(row).eq('id',b.id).eq('active',true).select('id').single()
        : await db.from('system_line_target').insert({...row,account:'dev',target_type:'group',summary_keywords:['NHK']}).select('id').single();
      if (result.error?.code === '23505' && code) continue;
      checked(result);
      return NextResponse.json({id:result.data?.id,code});
    }
    return NextResponse.json({error:'確認コードを作れませんでした。時間をおいてお試しください。'}, {status:409});
  } catch { return NextResponse.json({error:'入力内容を確認してください。保存できませんでした。'}, {status:400}); }
}
