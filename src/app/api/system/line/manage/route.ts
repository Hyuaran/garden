import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checked, loadLineData, requireLineAdmin } from '@/lib/line/tags.server';
import { chunks, personalize, recipients } from '@/lib/line/tags';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getLineStaffQuota, pushLineStaff } from '@/lib/line/staff-client';
export const runtime='nodejs';
function sign(value:string) { const secret=process.env.LINE_STAFF_CHANNEL_SECRET; if(!secret) throw new Error('送信の設定を確認してください。'); return createHmac('sha256',secret).update(value).digest('hex'); }
export async function GET() {
  if(!await requireLineAdmin()) return NextResponse.json({}, {status:403});
  try { return NextResponse.json(await loadLineData()); } catch { return NextResponse.json({error:'一覧を取得できませんでした。'}, {status:500}); }
}
export async function POST(request:Request) {
  const admin=await requireLineAdmin(); if(!admin) return NextResponse.json({}, {status:403});
  try {
    const b=await request.json(); const db=getSupabaseAdmin();
    if(b.action==='tag') {
      if(!['free','business'].includes(b.kind) || typeof b.name!=='string' || !b.name.trim() || b.name.length>100) throw new Error('タグの名前を確認してください。');
      if(b.id) checked(await db.from('system_line_tag').update({name:b.name.trim()}).eq('id',b.id).eq('kind',b.kind));
      else checked(await db.from('system_line_tag').insert({kind:b.kind,name:b.name.trim()}));
    } else if(b.action==='deleteTag') {
      checked(await db.from('system_line_tag').delete().eq('id',b.id).eq('kind','free'));
    } else if(b.action==='member') {
      const tag=checked(await db.from('system_line_tag').select('kind').eq('id',b.tagId).single()).data;
      if(!['business','free'].includes(tag?.kind ?? '')) throw new Error('このタグは名簿から更新します。');
      if(b.add) checked(await db.from('system_line_tag_member').upsert({tag_id:b.tagId,employee_id:b.employeeId,source:'manual'}));
      else checked(await db.from('system_line_tag_member').delete().eq('tag_id',b.tagId).eq('employee_id',b.employeeId).eq('source','manual'));
    } else if(b.action==='greeting') {
      if(typeof b.body!=='string'||!b.body.trim()||b.body.length>5000) throw new Error('文は1〜5000文字で入力してください。');
      const tags=checked(await db.from('system_line_tag').select('id,kind')).data;
      for(const [id,kind] of [[b.employment_tag_id,'employment'],[b.business_tag_id,'business']]) if(id&&!tags?.some(t=>t.id===id&&t.kind===kind)) throw new Error('区分を確認してください。');
      if(b.business_tag_id&&!b.employment_tag_id) throw new Error('雇用形態を選んでください。');
      const row={employment_tag_id:b.employment_tag_id||null,business_tag_id:b.business_tag_id||null,body:b.body,enabled:b.enabled!==false,updated_by:admin.employee_id,updated_at:new Date().toISOString()};
      if(b.id) checked(await db.from('system_line_greeting').update(row).eq('id',b.id)); else checked(await db.from('system_line_greeting').insert(row));
    } else if(b.action==='test') {
      if(b.confirm!==true) throw new Error('送信数に1通数えます。確認してください。');
      const own=checked(await db.from('root_employees').select('line_user_id,line_link_source,name').eq('employee_id',admin.employee_id).single()).data;
      const g=checked(await db.from('system_line_greeting').select('body').eq('id',b.id).single()).data;
      if(!own?.line_user_id||own.line_link_source==='unfollowed') throw new Error('自分のLINEを紐づけてください。');
      if(!g) throw new Error('文が見つかりません。');
      await pushLineStaff([own.line_user_id],personalize(g.body,own.name));
    } else if(b.action==='preview'||b.action==='send') {
      if(!Array.isArray(b.tagIds)||b.tagIds.some((x:unknown)=>typeof x!=='string')||typeof b.body!=='string'||!b.body.trim()||b.body.length>5000||typeof b.title!=='string'||!b.title.trim()||b.title.length>200) throw new Error('題名・文・タグを確認してください。');
      const d=await loadLineData();
      if(b.tagIds.some((id:string)=>!d.tags.some(t=>t.id===id))) throw new Error('タグを選び直してください。');
      const people=recipients(d.employees,b.tagIds,d.tags,d.members);
      const ids=[...new Set(people.map(e=>e.line_user_id!))].sort();
      const content=JSON.stringify({ids,title:b.title,body:b.body,tagIds:[...b.tagIds].sort(),actor:admin.employee_id});
      if(b.action==='preview') {
        const quota=await getLineStaffQuota();
        if(!ids.length || (quota.remaining!==null&&quota.remaining<ids.length)) throw new Error('送る人がいないか、今月の残り通数が足りません。');
        const row=checked(await db.from('system_line_broadcast').insert({title:b.title,body:b.body,tag_ids:b.tagIds,recipient_count:ids.length,created_by:admin.employee_id}).select('id').single()).data;
        if(!row) throw new Error('記録を保存できませんでした。');
        const expires=Date.now()+5*60*1000;
        return NextResponse.json({people,remaining:quota.remaining,id:row.id,expires,signature:sign(content+row.id+expires)});
      }
      const expected=Buffer.from(sign(content+b.id+b.expires)); const supplied=Buffer.from(String(b.signature||''));
      if(Date.now()>Number(b.expires)||expected.length!==supplied.length||!timingSafeEqual(expected,supplied)) throw new Error('送る人をもう一度確認してください。');
      const claim=checked(await db.from('system_line_broadcast').update({sent_at:new Date().toISOString()}).eq('id',b.id).eq('created_by',admin.employee_id).is('sent_at',null).select('id'));
      if(!claim.data?.length) throw new Error('この送信はすでに処理されています。');
      let sent=0,failed=0;
      for(const batch of chunks(ids)) { try { await pushLineStaff(batch,b.body); sent+=batch.length; } catch { failed+=batch.length; } }
      checked(await db.from('system_line_broadcast').update({sent_count:sent,failed_count:failed}).eq('id',b.id));
      return NextResponse.json({sent,failed});
    } else throw new Error('操作を確認してください。');
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'処理に失敗しました。'}, {status:400}); }
}
