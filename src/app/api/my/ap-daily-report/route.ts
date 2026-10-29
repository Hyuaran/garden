import { NextResponse } from 'next/server';
import { createServerClient } from '@/app/_lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isEmployeeActive } from '@/lib/auth/employee-access';
import { normalizeCallMetricsRpc } from '@/app/system/_lib/call-metrics';
import { resolveEmployeeIdForCallMetrics } from '@/app/system/_lib/call-metrics-merge';
import { parseJstDate } from '@/app/system/_lib/attendance';
import { ChatworkClient } from '@/lib/chatwork/client';
import { attendance, buildMessage, coinKeys, fixedKind, validateReport, type Report } from '@/app/my/ap-daily-report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function identity() {
  const session = await createServerClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await session.from('root_employees').select('employee_id,employee_number,name,garden_role,is_active,termination_date,deleted_at').eq('user_id',auth.user.id).eq('is_active',true).is('deleted_at',null).maybeSingle();
  if (error) throw new Error('従業員情報を確認できませんでした');
  return data && isEmployeeActive(data) ? data : null;
}
async function load(employee: NonNullable<Awaited<ReturnType<typeof identity>>>, date: string) {
  const admin = getSupabaseAdmin();
  const month = date.slice(0,7)+'-01';
  const [year, monthNumber] = month.split('-').map(Number);
  const until = new Date(Date.UTC(year,monthNumber,1)-9*3600000);
  const monthEnd = new Date(until.getTime()+9*3600000-86400000).toISOString().slice(0,10);
  const today = parseJstDate(null).date;
  const since = new Date(Date.parse(today+'T00:00:00Z')-30*86400000).toISOString().slice(0,10);
  const [roots, day, monthly, punches, records] = await Promise.all([
    admin.from('root_employees').select('employee_id,name,filemaker_employee_name,is_active,deleted_at'),
    admin.rpc('system_call_metrics',{p_from:date,p_to:date,p_list_name:null,p_employee_name:null}),
    admin.rpc('system_call_metrics',{p_from:month,p_to:monthEnd,p_list_name:null,p_employee_name:null}),
    admin.from('system_attendance_punches').select('punch_type,punched_at').eq('employee_id',employee.employee_id).gte('punched_at',parseJstDate(month).from).lt('punched_at',until.toISOString()).order('punched_at'),
    admin.from('system_ap_daily_report').select('*').eq('employee_id',employee.employee_id).gte('report_date',[month,since,date].sort()[0]).lte('report_date',[monthEnd,today,date].sort().at(-1)!).order('report_date',{ascending:false}),
  ]);
  if ([roots,day,monthly,punches,records].some(r=>r.error) || day.data?.error || monthly.data?.error) throw new Error('日報の情報を読み込めませんでした');
  function metrics(data: unknown, from: string, to: string) {
    return normalizeCallMetricsRpc(data,{from,to,listName:null,employeeName:null}).employeeMetrics.filter(r=>resolveEmployeeIdForCallMetrics(r.employeeName,roots.data ?? []) === employee.employee_id);
  }
  const daily = metrics(day.data,date,date), all = metrics(monthly.data,month,monthEnd);
  const sum = (key: keyof typeof daily[number]) => daily.reduce((s,r)=>s+Number(r[key] ?? 0),0);
  const rows = (records.data ?? []) as Report[];
  const record = rows.find(r=>r.report_date === date) ?? null;
  const dayPunches = (punches.data ?? []).filter(p=>new Date(Date.parse(p.punched_at)+9*3600000).toISOString().slice(0,10) === date);
  const hoursByDay = new Map<string, typeof dayPunches>();
  for (const p of punches.data ?? []) { const d = new Date(Date.parse(p.punched_at)+9*3600000).toISOString().slice(0,10); hoursByDay.set(d,[...(hoursByDay.get(d) ?? []),p]); }
  const autoMinutes = [...hoursByDay.values()].reduce((s,p)=>s+attendance(p).work_minutes,0);
  const monthRecords = rows.filter(r=>r.report_date >= month && r.report_date <= monthEnd);
  const monthMinutes = autoMinutes + monthRecords.reduce((s,r)=>s+r.work_minutes-attendance(hoursByDay.get(r.report_date) ?? []).work_minutes,0);
  const calls = sum('callCount');
  const auto = { ...attendance(dayPunches), calls, absent:sum('awayCount') /* 留守。absentCount は「担不（担当者不在）」なので使わない */, prospect:sum('prospectCount'), effective_rate:calls ? sum('effectiveCount')/calls*100 : 0, toss:sum('tossCount'), closer:sum('acquiredCount') };
  const totals = { toss:0, closer:0 };
  for (const kind of ['toss','closer'] as const) totals[kind] = all.reduce((s,r)=>s+(kind === 'toss' ? r.tossCount : r.acquiredCount),0)+monthRecords.filter(r=>r.kind === kind).reduce((s,r)=>s+r.count-r.auto_count,0);
  return { record, recent: rows.filter(r=>r.report_date >= since && r.report_date <= today), auto, totals, monthMinutes, employee: { name:employee.name, number:employee.employee_number, kind:fixedKind(employee.garden_role) } };
}
export async function GET(request: Request) {
  try {
    const employee = await identity();
    if (!employee) return NextResponse.json({error:'ログイン中の在籍者のみ利用できます'},{status:401});
    let date: string;
    try { date = parseJstDate(new URL(request.url).searchParams.get('date')).date; } catch { return NextResponse.json({error:'日付を確認してください'},{status:400}); }
    return NextResponse.json(await load(employee,date));
  } catch { return NextResponse.json({error:'日報の情報を読み込めませんでした'},{status:500}); }
}
export async function POST(request: Request) {
  try {
    const employee = await identity();
    if (!employee) return NextResponse.json({error:'ログイン中の在籍者のみ利用できます'},{status:401});
    let input: Report;
    try { const body = await request.json(); input = validateReport({...body,kind:fixedKind(employee.garden_role) ?? body.kind}); } catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : '入力を確認してください'},{status:400}); }
    const data = await load(employee,input.report_date);
    const monthMinutes = data.monthMinutes - (data.record?.work_minutes ?? data.auto.work_minutes) + input.work_minutes;
    const report: Report = { ...input, ...data.auto, kind:input.kind, start_time:input.start_time,end_time:input.end_time,work_minutes:input.work_minutes, employee_name:employee.name, auto_count:data.auto[input.kind], count:input.count, month_total:input.kind === 'closer' ? input.month_total : 0, efficiency:input.kind === 'closer' && monthMinutes > 0 ? input.month_total/(monthMinutes/60) : 0, sent_count:data.record?.sent_count ?? 0 };
    const admin = getSupabaseAdmin();
    const saved = await admin.from('system_ap_daily_report').upsert({employee_id:employee.employee_id,employee_number:employee.employee_number,employee_name:employee.name,report_date:report.report_date,kind:report.kind,start_time:report.start_time,end_time:report.end_time,work_minutes:report.work_minutes,calls:report.calls,absent:report.absent,prospect:report.prospect,effective_rate:report.effective_rate,auto_count:report.auto_count,count:report.count,month_total:report.month_total,efficiency:report.efficiency,reflection:report.reflection,...Object.fromEntries(coinKeys.map(k=>[k,input[k] ?? null])),updated_at:new Date().toISOString()},{onConflict:'employee_id,report_date'}).select('id').single();
    if (saved.error || !saved.data) throw new Error('save');
    const message = buildMessage(report,report.sent_count > 0);
    let chatwork_error: string | null = null, messageId: string | undefined;
    try {
      const room = process.env.AP_DAILY_REPORT_CHATWORK_ROOM_ID;
      if (!room || !process.env.CHATWORK_API_TOKEN) throw new Error('Chatwork の設定がありません');
      messageId = (await new ChatworkClient(process.env.CHATWORK_API_TOKEN).sendMessage(room,message)).message_id;
    } catch (e) { chatwork_error = e instanceof Error && e.message === 'Chatwork の設定がありません' ? e.message : 'Chatwork への投稿に失敗しました'; }
    const updated = await admin.from('system_ap_daily_report').update({chatwork_error,...(messageId ? {chatwork_message_id:messageId,sent_count:report.sent_count+1} : {})}).eq('id',saved.data.id);
    return NextResponse.json({ok:true,chatwork_error,message,report:{...report,sent_count:report.sent_count+(messageId ? 1 : 0)},status_error:updated.error ? '送信結果の記録に失敗しました。管理者へお問い合わせください' : null});
  } catch { return NextResponse.json({error:'日報を保存できませんでした'},{status:500}); }
}
