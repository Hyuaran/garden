import { queueRosterPush } from '@/app/root/_lib/roster-push.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/app/system/mypage/_lib/submission-server';
import { systemViewResponse } from '@/lib/auth/view-permission.server';
import { validTeamInput } from '@/app/root/_lib/team-history';
import { syncRichMenus } from '@/lib/line/richmenu.server';

type Context = { params: Promise<{ employeeId: string }> };
export async function GET(_request: Request, context: Context) {
  const denied = await systemViewResponse('root-employees');
  if (denied) return denied;
  const { employeeId } = await context.params;
  const { data, error } = await getSupabaseAdmin().from('root_employee_team_history').select('*').eq('employee_id', employeeId).order('effective_date', {ascending:false}).order('entered_at', {ascending:false}).order('id', {ascending:false});
  return error ? Response.json({error:'読み込めませんでした。'}, {status:500}) : Response.json({rows:data}, {headers:{'Cache-Control':'private, no-store'}});
}
async function mutate(request: Request, context: Context) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({error:'編集権限がありません。'}, {status:403});
  const { employeeId } = await context.params;
  const body = await request.json().catch(()=>null);
  if (!body || typeof body !== 'object' || (request.method !== 'DELETE' && !validTeamInput(body)) || (request.method !== 'POST' && typeof body.id !== 'string')) return Response.json({error:'入力を確認してください。'}, {status:400});
  const db = getSupabaseAdmin();
  const employee = await db.from('root_employees').select('employee_id').eq('employee_id',employeeId).is('deleted_at',null).maybeSingle();
  if (employee.error) return Response.json({error:'読み込めませんでした。'}, {status:500});
  if (!employee.data) return Response.json({error:'社員が見つかりません。'}, {status:404});
  const payload = {effective_date:body.effective_date, team:body.team, memo:body.memo || null, entered_by:actor.employee_id, entered_at:new Date().toISOString()};
  let result;
  if (request.method === 'POST') {
    result = await db.from('root_employee_team_history').insert({...payload,employee_id:employeeId,source:'garden'}).select('id');
  } else {
    const row = await db.from('root_employee_team_history').select('source').eq('employee_id',employeeId).eq('id',body.id).maybeSingle();
    if (row.error) return Response.json({error:'読み込めませんでした。'}, {status:500});
    if (!row.data) return Response.json({error:'履歴が見つかりません。'}, {status:404});
    if (row.data.source !== 'garden') return Response.json({error:'Kintone から取り込んだ行です'}, {status:403});
    const query = db.from('root_employee_team_history');
    result = await (request.method === 'DELETE' ? query.delete() : query.update(payload)).eq('employee_id',employeeId).eq('id',body.id).eq('source','garden').select('id');
  }
  if (result.error) return Response.json({error:'保存できませんでした。'}, {status:500});
  if (!result.data?.length) return Response.json({error:'履歴が見つかりません。'}, {status:404});
  let warning = (await queueRosterPush(employeeId,'team')).warning;
  await syncRichMenus(employeeId).catch(()=>{ warning='Garden には記録しました。LINE への反映に失敗しました。次の名簿取り込みで再反映します。'; });
  return Response.json({ok:true,warning});
}
export const POST = mutate;
export const PATCH = mutate;
export const DELETE = mutate;
