"use server";

/**
 * Tree Phase D-02: tree_call_records INSERT Server Action
 *
 * 既存 _lib/queries.ts の insertCall（soil_call_history 用）とは別実装。
 * Phase D-1 は tree_call_records にのみ INSERT、D-04 で D-04 toss flow と連携。
 *
 * spec: docs/specs/tree/spec-tree-phase-d-02-operator-ui.md §3.2
 *       docs/specs/tree/spec-tree-phase-d-01-schema-migration.md §3.2 / §0-2
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ResultCode, ResultGroup } from "../_lib/resultCodeMapping";

export type InsertTreeCallRecordInput = {
  session_id: string;
  campaign_code: string;
  result_code: ResultCode;
  result_group: ResultGroup;
  memo?: string;
  agreement_confirmed?: boolean;
  duration_sec?: number | null;
  list_id?: number | null;
  accessToken: string;
};

export type InsertTreeCallRecordErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'EMPLOYEE_NOT_FOUND'
  | 'MEMO_REQUIRED'
  | 'DB_ERROR'
  | 'UNKNOWN';

export type InsertTreeCallRecordResult =
  | { success: true; call_id: string }
  | { success: false; errorCode: InsertTreeCallRecordErrorCode; errorMessage: string };

const ERROR_MESSAGES: Record<InsertTreeCallRecordErrorCode, string> = {
  UNAUTHENTICATED: '認証が切れました。再ログインしてください',
  INVALID_INPUT: '入力値が不正です',
  EMPLOYEE_NOT_FOUND: '従業員情報が見つかりません',
  MEMO_REQUIRED: 'トス時はメモが必須です',
  DB_ERROR: 'コール記録の保存に失敗しました',
  UNKNOWN: '不明なエラーが発生しました',
};

const VALID_RESULT_CODES: ResultCode[] = [
  'toss','order','tantou_fuzai','coin',
  'sight_A','sight_B','sight_C',
  'unreach','ng_refuse','ng_claim','ng_contracted','ng_other',
];
const VALID_RESULT_GROUPS: ResultGroup[] = ['positive','pending','negative','neutral'];

function fail(code: InsertTreeCallRecordErrorCode, override?: string): InsertTreeCallRecordResult {
  return { success: false, errorCode: code, errorMessage: override ?? ERROR_MESSAGES[code] };
}

export async function insertTreeCallRecord(input: InsertTreeCallRecordInput): Promise<InsertTreeCallRecordResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return fail('UNKNOWN', '環境変数未設定');

  // 入力検証
  if (!input.session_id) return fail('INVALID_INPUT', 'session_id が空です');
  if (!input.campaign_code) return fail('INVALID_INPUT', 'campaign_code が空です');
  if (!VALID_RESULT_CODES.includes(input.result_code)) return fail('INVALID_INPUT', 'result_code が不正です');
  if (!VALID_RESULT_GROUPS.includes(input.result_group)) return fail('INVALID_INPUT', 'result_group が不正です');

  // メモ必須（トス時、業務ルール）
  if (input.result_code === 'toss' && (!input.memo || input.memo.trim().length === 0)) {
    return fail('MEMO_REQUIRED');
  }

  // メモ文字数制限（D-02 §0-7、500 文字 truncate）
  let safeMemo = input.memo ?? null;
  if (safeMemo && safeMemo.length > 500) {
    safeMemo = safeMemo.slice(0, 500);
  }

  // access_token 検証
  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await verifyClient.auth.getUser(input.accessToken);
  if (userError || !userData?.user) return fail('UNAUTHENTICATED');

  // employee_number 取得
  const admin = getSupabaseAdmin();
  const { data: employee, error: empError } = await admin
    .from('root_employees')
    .select('employee_number')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (empError || !employee) return fail('EMPLOYEE_NOT_FOUND');

  // INSERT
  const { data: insertData, error: insertError } = await admin
    .from('tree_call_records')
    .insert({
      session_id: input.session_id,
      list_id: input.list_id ?? null,
      employee_id: (employee as { employee_number: string }).employee_number,
      campaign_code: input.campaign_code,
      result_code: input.result_code,
      result_group: input.result_group,
      duration_sec: input.duration_sec ?? null,
      memo: safeMemo,
      agreement_confirmed: input.agreement_confirmed ?? false,
    })
    .select('call_id')
    .single();

  if (insertError || !insertData) return fail('DB_ERROR', insertError?.message);
  return { success: true, call_id: (insertData as { call_id: string }).call_id };
}
