"use server";

/**
 * Tree Phase B-β B 経路：マイページから誕生日を変更し、
 * Auth パスワードも MMDD に同期する Server Action。
 *
 * 仕様書: docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md
 * 親仕様: docs/specs/2026-04-24-tree-phase-b-beta-birthday-password.md §2.1 B 経路
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ChangeBirthdayWithPasswordInput = {
  /** YYYY-MM-DD 形式 */
  newBirthday: string;
  /** 本人確認用の現在のパスワード */
  currentPassword: string;
  /** クライアント側 supabase.auth.getSession().access_token */
  accessToken: string;
};

export type ChangeBirthdayErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_FORMAT"
  | "SAME_AS_CURRENT"
  | "WRONG_PASSWORD"
  | "RATE_LIMITED"
  | "TRANSACTION_FAILED"
  | "UNKNOWN";

export type ChangeBirthdayWithPasswordResult =
  | { success: true }
  | {
      success: false;
      errorCode: ChangeBirthdayErrorCode;
      errorMessage: string;
    };

const ERROR_MESSAGES: Record<ChangeBirthdayErrorCode, string> = {
  UNAUTHENTICATED: "認証が切れました。再ログインしてください",
  INVALID_FORMAT: "誕生日の形式が正しくありません",
  SAME_AS_CURRENT:
    "現在の誕生日と同じ値です。異なる日付を入力してください",
  WRONG_PASSWORD: "現在のパスワードが違います",
  RATE_LIMITED:
    "短時間に連続しての変更はできません。10 分以上空けて再度お試しください",
  TRANSACTION_FAILED:
    "一時的な障害が発生しました。少し待ってから再度お試しください",
  UNKNOWN:
    "不明なエラーが発生しました。時間をおいて再度お試しください",
};

function fail(
  errorCode: ChangeBirthdayErrorCode,
  override?: string,
): ChangeBirthdayWithPasswordResult {
  return {
    success: false,
    errorCode,
    errorMessage: override ?? ERROR_MESSAGES[errorCode],
  };
}

export async function changeBirthdayWithPassword(
  input: ChangeBirthdayWithPasswordInput,
): Promise<ChangeBirthdayWithPasswordResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return fail("UNKNOWN");

  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } =
    await verifyClient.auth.getUser(input.accessToken);
  if (userError || !userData?.user) return fail("UNAUTHENTICATED");

  const dateMatch = input.newBirthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return fail("INVALID_FORMAT");
  // Asia/Tokyo basis（MEMORY: feedback_server_timezone）
  const todayJst = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  if (input.newBirthday > todayJst) return fail("INVALID_FORMAT");

  const admin = getSupabaseAdmin();
  const { data: employee, error: empError } = await admin
    .from("root_employees")
    .select("birthday, employee_number")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (empError || !employee) return fail("UNAUTHENTICATED");

  if (employee.birthday === input.newBirthday) return fail("SAME_AS_CURRENT");

  return fail("UNKNOWN");
}
