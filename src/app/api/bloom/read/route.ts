import { bloomTreePageKey } from '@/lib/auth/bloom-tree-view-scopes';
import { requireBloomTreeRead } from '@/lib/auth/bloom-tree-view.server';
import { ViewPermissionError } from '@/lib/auth/view-permission.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isRoleAtLeast } from '@/app/root/_constants/types';

const pages: Record<string,string[]> = {
  digests:['bloom-monthly-digest'], digest:['bloom-monthly-digest-month','bloom-monthly-digest-edit'],
  roadmap:['bloom-roadmap','bloom-workboard'], modules:['bloom-roadmap'],
  myStatus:['bloom-workboard'], teamStatus:['bloom-workboard'], todayLog:['bloom-workboard'], recentLogs:['bloom-workboard'],
};
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const op = url.searchParams.get('operation') ?? '';
    const page = bloomTreePageKey(url.searchParams.get('page') ?? '');
    if (!page || !pages[op]?.includes(page)) throw new ViewPermissionError('閲覧権限がありません');
    const operationTab = page === 'bloom-workboard' ? ({teamStatus:'members',recentLogs:'weekly',myStatus:'today',todayLog:'today',roadmap:'today'} as Record<string,string>)[op] : '';
    const {userId,viewer} = await requireBloomTreeRead(page,operationTab);
    const args = JSON.parse(url.searchParams.get('args') ?? '{}');
    const db = getSupabaseAdmin();
    let query;
    switch(op) {
      case 'digests': query=db.from('bloom_monthly_digests').select('*').order('digest_month',{ascending:false}); break;
      case 'digest': {
        if (typeof args.month !== 'string' || !/^\d{4}-\d{2}(-01)?$/.test(args.month)) return Response.json({error:'月の指定が不正です'},{status:400});
        query=db.from('bloom_monthly_digests').select('*').eq('digest_month',args.month.slice(0,7)+'-01').maybeSingle(); break;
      }
      case 'roadmap': query=db.from('bloom_roadmap_entries').select('*').order('sort_order'); break;
      case 'modules': query=db.from('bloom_module_progress').select('*').order('display_order'); break;
      case 'myStatus': query=db.from('bloom_worker_status').select('*').eq('user_id',userId).maybeSingle(); break;
      case 'teamStatus': {
        query=db.from('bloom_worker_status').select(isRoleAtLeast(viewer.role,'manager') && !args.managerMode ? 'user_id,status,status_note,until,updated_at,updated_by' : 'user_id,status,updated_at').order('updated_at',{ascending:false});
        if (!isRoleAtLeast(viewer.role,'manager')) query=query.eq('user_id',userId);
        break;
      }
      case 'todayLog': query=db.from('bloom_daily_logs').select('*').eq('user_id',userId).eq('log_date',String(args.dateISO)).maybeSingle(); break;
      case 'recentLogs': query=db.from('bloom_daily_logs').select('*').eq('user_id',userId).gte('log_date',String(args.sinceISO)).order('log_date',{ascending:false}); break;
      default: throw new ViewPermissionError('閲覧権限がありません');
    }
    const {data,error} = await query;
    if (error) return Response.json({error:'データを取得できませんでした'},{status:503});
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(e) {
    if (e instanceof ViewPermissionError) return Response.json({error:e.message},{status:e.status});
    if (e instanceof SyntaxError) return Response.json({error:'引数が不正です'},{status:400});
    throw e;
  }
}
