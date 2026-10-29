import { NextResponse } from 'next/server';
import { requireEmployee } from '@/app/system/mypage/_lib/submission-server';
import { systemViewResponse } from '@/lib/auth/view-permission.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createRecord } from '@/lib/kintone/records';
import { expenseRecord, recentCombinations, validateExpense } from '@/app/system/forms/expense/_lib/expense';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const denied = await systemViewResponse('system-expense'); if (denied) return denied;
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 403 });
  const input = validateExpense(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ ok: false, error: '必須項目・金額・用途の詳細を確認してください' }, { status: 400 });
  const db = getSupabaseAdmin();
  const { data: report, error } = await db.from('system_expense_report').insert({ ...input, employee_number: String(employee.employee_number), employee_name: String(employee.name), submitted_by: employee.userId }).select('*').single();
  if (error || !report) return NextResponse.json({ ok: false, error: '記録を保存できませんでした' }, { status: 500 });
  let kintone_error: string | null = null, kintone_record_id: string | null = null, kintone_sent_at: string | null = null;
  try {
    const token = process.env.KINTONE_EXPENSE_REPORT_TOKEN, roster = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN;
    if (!token || !roster || !process.env.KINTONE_SUBDOMAIN) throw new Error('Kintone の設定がありません');
    const result = await createRecord(process.env.KINTONE_EXPENSE_REPORT_APP_ID || '95', `${token},${roster}`, expenseRecord(input, String(employee.employee_number), report.created_at));
    kintone_record_id = result.id; kintone_sent_at = new Date().toISOString();
  } catch (error) { kintone_error = error instanceof Error ? error.message : String(error); }
  const sync = { kintone_error, kintone_record_id, kintone_sent_at };
  const { error: syncError } = await db.from('system_expense_report').update(sync).eq('id', report.id);
  if (syncError) console.error('expense sync status save failed', report.id, syncError.code);
  return NextResponse.json({ ok: true, report: { ...report, ...sync }, kintone_error });
}
export async function GET(request: Request) {
  const denied = await systemViewResponse('system-expense'); if (denied) return denied;
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 403 });
  if (new URL(request.url).searchParams.get('recent') !== '1') return NextResponse.json({ ok: false }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from('system_expense_report').select('*').eq('submitted_by', employee.userId).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: '最近の報告を読み込めませんでした' }, { status: 500 });
  const latest = await Promise.all(['nhk', 'nhk-kanden', 'ueda'].map(async form => {
    const result = await getSupabaseAdmin().from('system_expense_report').select('business').eq('submitted_by', employee.userId).eq('form', form).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return [form, result.data?.business ?? ''] as const;
  }));
  // 「前と同じ内容で入れる」は 1 週間より前の入力からも選べるように、新しい 50 件から作る
  const older = await getSupabaseAdmin().from('system_expense_report').select('*').eq('submitted_by', employee.userId).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ ok: true, reports: data ?? [], combinations: recentCombinations(older.data ?? data ?? []), lastBusinesses: Object.fromEntries(latest) });
}
