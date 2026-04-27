"use server";

/**
 * Garden Tree Phase D-02 — セッション open/close Server Action
 *
 * spec: docs/specs/tree/spec-tree-phase-d-02-operator-ui.md §3.1
 *
 * 設計:
 *   - accessToken をクライアントから受け取り、anon client で auth.getUser 検証
 *   - 検証済 user.id で root_employees.employee_number を取得（admin client）
 *   - tree_calling_sessions に INSERT（openSession）/ UPDATE（closeSession）
 *   - 既存アクティブセッションがある場合は事前 close（openSession 内）
 *
 * テーブル前提（D-01 migration 投入済み）:
 *   tree_calling_sessions(
 *     session_id uuid PK,
 *     employee_id text REFERENCES root_employees(employee_number),
 *     campaign_code text,
 *     mode text CHECK (mode IN ('sprout','branch','breeze','aporan','confirm')),
 *     started_at timestamptz DEFAULT now(),
 *     ended_at timestamptz,
 *     notes text,
 *     ...
 *   )
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ============================================================
// 型定義
// ============================================================

export type SessionMode = "sprout" | "branch" | "breeze" | "aporan" | "confirm";

export type OpenSessionInput = {
  campaign_code: string;
  mode: SessionMode;
  /** クライアント側 supabase.auth.getSession().data.session?.access_token */
  accessToken: string;
};

export type SessionErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "EMPLOYEE_NOT_FOUND"
  | "DB_ERROR"
  | "UNKNOWN";

export type OpenSessionResult =
  | { success: true; session_id: string }
  | { success: false; errorCode: SessionErrorCode; errorMessage: string };

export type CloseSessionInput = {
  session_id: string;
  accessToken: string;
};

export type CloseSessionResult =
  | { success: true }
  | { success: false; errorCode: SessionErrorCode; errorMessage: string };

// ============================================================
// 定数
// ============================================================

const VALID_MODES: SessionMode[] = ["sprout", "branch", "breeze", "aporan", "confirm"];

const ERROR_MESSAGES: Record<SessionErrorCode, string> = {
  UNAUTHENTICATED: "認証が切れました。再ログインしてください",
  INVALID_INPUT: "入力値が不正です",
  EMPLOYEE_NOT_FOUND: "従業員情報が見つかりません",
  DB_ERROR: "データベース処理に失敗しました",
  UNKNOWN: "不明なエラーが発生しました",
};

// ============================================================
// ヘルパー
// ============================================================

function fail(
  code: SessionErrorCode,
  override?: string,
): { success: false; errorCode: SessionErrorCode; errorMessage: string } {
  return {
    success: false,
    errorCode: code,
    errorMessage: override ?? ERROR_MESSAGES[code],
  };
}

/**
 * accessToken を検証して Supabase Auth ユーザーを取得する。
 * anon client を都度生成して getUser を呼ぶ（Server Action 内では
 * ブラウザの Cookie セッションが利用できないため accessToken を明示的に受け取る）。
 */
async function verifyToken(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
): Promise<{ userId: string } | null> {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return { userId: data.user.id };
}

// ============================================================
// openSession
// ============================================================

/**
 * オペレーターのコールセッションを開始する。
 *
 * - 既存アクティブセッション（ended_at IS NULL）があれば事前 close
 * - tree_calling_sessions に新規レコードを INSERT
 * - 成功時は session_id を返す
 */
export async function openSession(
  input: OpenSessionInput,
): Promise<OpenSessionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return fail("UNKNOWN", "環境変数が設定されていません");
  }

  // 1. 入力検証（認証前に弾く）
  if (!input.campaign_code || typeof input.campaign_code !== "string") {
    return fail("INVALID_INPUT");
  }
  if (!VALID_MODES.includes(input.mode as SessionMode)) {
    return fail("INVALID_INPUT");
  }

  // 2. accessToken 検証
  const verified = await verifyToken(supabaseUrl, anonKey, input.accessToken);
  if (!verified) return fail("UNAUTHENTICATED");

  // 3. employee_number 取得（admin client で RLS バイパス）
  const admin = getSupabaseAdmin();
  const { data: employee, error: empError } = await admin
    .from("root_employees")
    .select("employee_number")
    .eq("user_id", verified.userId)
    .maybeSingle();

  if (empError || !employee) return fail("EMPLOYEE_NOT_FOUND");

  const employeeNumber = (employee as { employee_number: string }).employee_number;

  // 4. 既存アクティブセッションを close（同一オペレーターは同時 1 本のみ）
  await admin
    .from("tree_calling_sessions")
    .update({
      ended_at: new Date().toISOString(),
      notes: "auto-closed by openSession",
    })
    .eq("employee_id", employeeNumber)
    .is("ended_at", null);
  // ※ close 失敗してもセッション開始は続行（運用上の軽微エラーとして扱う）

  // 5. 新規セッション INSERT
  const { data: insertData, error: insertError } = await admin
    .from("tree_calling_sessions")
    .insert({
      employee_id: employeeNumber,
      campaign_code: input.campaign_code,
      mode: input.mode,
    })
    .select("session_id")
    .single();

  if (insertError || !insertData) {
    return fail("DB_ERROR", insertError?.message);
  }

  const sessionId = (insertData as { session_id: string }).session_id;
  return { success: true, session_id: sessionId };
}

// ============================================================
// closeSession
// ============================================================

/**
 * オペレーターのコールセッションを終了する。
 *
 * - 本人のセッションのみ close 可（employee_id で絞り込み）
 * - ended_at を現在時刻に UPDATE
 */
export async function closeSession(
  input: CloseSessionInput,
): Promise<CloseSessionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return fail("UNKNOWN", "環境変数が設定されていません");
  }

  // 1. accessToken 検証
  const verified = await verifyToken(supabaseUrl, anonKey, input.accessToken);
  if (!verified) return fail("UNAUTHENTICATED");

  // 2. employee_number 取得
  const admin = getSupabaseAdmin();
  const { data: employee } = await admin
    .from("root_employees")
    .select("employee_number")
    .eq("user_id", verified.userId)
    .maybeSingle();

  if (!employee) return fail("EMPLOYEE_NOT_FOUND");

  const employeeNumber = (employee as { employee_number: string }).employee_number;

  // 3. セッション終了 UPDATE（employee_id で本人限定）
  const { error: updateError } = await admin
    .from("tree_calling_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_id", input.session_id)
    .eq("employee_id", employeeNumber)
    .is("ended_at", null);

  if (updateError) {
    return fail("DB_ERROR", updateError.message);
  }

  return { success: true };
}
