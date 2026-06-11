/**
 * GET /api/bud/expense-drive/diag
 * Drive 連携の診断（一時用）。秘密情報は返さず、各段階の成否ブール値のみ返す。
 *   hasEnv      … GOOGLE_SERVICE_ACCOUNT_JSON が設定されているか
 *   envParses   … その JSON がパースできるか
 *   tokenOk     … サービスアカウントでトークン取得できたか
 *   rootVisible … 共有フォルダ(20_Garden Series Drive)が見えるか
 * 動作確認が済んだら削除する。
 */

import { NextResponse } from "next/server";

import { getDriveAccessToken } from "../_lib/drive";

export async function GET() {
  const out: Record<string, boolean | string> = {
    hasEnv: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    envParses: false,
    tokenOk: false,
    rootVisible: false,
  };
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
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
        encodeURIComponent("name contains 'Garden Series'") +
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
