/**
 * GET /api/bud/expense-drive/diag
 * Drive 連携の診断（一時用）。秘密情報は返さず、各段階の成否ブール値のみ返す。
 *   hasEnv      … GOOGLE_DRIVE_OAUTH_JSON が設定されているか
 *   envParses   … その JSON がパースできるか
 *   tokenOk     … サービスアカウントでトークン取得できたか
 *   rootVisible … アプリ作成フォルダ(Bud_経費精算)が見えるか
 * 動作確認が済んだら削除する。
 */

import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { getDriveAccessToken, uploadToFolder } from "../_lib/drive";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const out: Record<string, boolean | string> = {
    hasEnv: Boolean(process.env.GOOGLE_DRIVE_OAUTH_JSON),
    envParses: false,
    tokenOk: false,
    rootVisible: false,
  };

  // 本人認証の到達確認（ログイン済みブラウザで開くと authed:true になる）
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    out.authed = Boolean(auth?.user?.id);
    if (auth?.user?.id) {
      const { data: emp } = await supabase
        .from("root_employees")
        .select("employee_id, expense_drive_folder_id")
        .eq("user_id", auth.user.id)
        .maybeSingle<{ employee_id: string; expense_drive_folder_id: string | null }>();
      out.employeeFound = Boolean(emp);
      out.folderSet = Boolean(emp?.expense_drive_folder_id);
      if (url.searchParams.get("write") === "1" && emp?.expense_drive_folder_id) {
        try {
          const up = await uploadToFolder(
            emp.expense_drive_folder_id,
            `diag-test-${Date.now()}.txt`,
            Buffer.from("diag"),
            "text/plain",
          );
          out.writeOk = Boolean(up.id);
        } catch (e) {
          out.writeOk = false;
          out.writeError = e instanceof Error ? e.message.slice(0, 160) : "unknown";
        }
      }
    }
  } catch (e) {
    out.authProbeError = e instanceof Error ? e.message.slice(0, 120) : "unknown";
  }
  try {
    if (process.env.GOOGLE_DRIVE_OAUTH_JSON) {
      JSON.parse(process.env.GOOGLE_DRIVE_OAUTH_JSON);
      out.envParses = true;
    }
  } catch {
    out.envParses = false;
  }
  try {
    const token = await getDriveAccessToken();
    out.tokenOk = Boolean(token);
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=" +
        encodeURIComponent("name contains 'Bud_経費精算'") +
        "&fields=files(id)&pageSize=1",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json()) as { files?: { id: string }[] };
    out.rootVisible = Boolean(data.files && data.files.length > 0);
  } catch (e) {
    out.error = e instanceof Error ? e.message.slice(0, 120) : "unknown";
  }
  return NextResponse.json(out);
}
