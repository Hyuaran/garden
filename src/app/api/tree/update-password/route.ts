/**
 * Garden-Tree — パスワード更新API（誕生日 → MMDD 自動反映）
 *
 * フロー:
 *   1. クライアントから Authorization: Bearer {access_token} + body { birthday: "YYYY-MM-DD" } を受け取る
 *   2. anon クライアントで access_token を検証 → userId を取得
 *   3. admin クライアント（service_role_key）で対象ユーザーのパスワードを MMDD に更新
 *
 * セキュリティ:
 *   - userId は必ず「検証済みトークン」から取得する（body 経由は受け付けない）
 *   - これにより他人のパスワードを書き換えできない（自分のトークンで自分の userId しか更新不可）
 *   - service_role_key はサーバー側でのみ使用、クライアントに露出させない
 *
 * 関連:
 *   - 親CLAUDE.md §4 認証ポリシー（一般社員パスワード = 誕生日MMDD）
 *   - src/app/tree/birthday/page.tsx （初回ログイン誕生日入力画面）
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[update-password] missing env vars");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "unauthorized (missing bearer token)" },
      { status: 401 },
    );
  }
  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } =
    await anonClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json(
      { error: "invalid or expired token" },
      { status: 401 },
    );
  }
  const userId = userData.user.id;

  let body: { birthday?: string };
  try {
    body = (await request.json()) as { birthday?: string };
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const birthday = body.birthday ?? "";
  const match = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return NextResponse.json(
      { error: "birthday must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const [, , mm, dd] = match;
  const newPassword = `${mm}${dd}`;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    userId,
    { password: newPassword },
  );
  if (updateError) {
    console.error(
      "[update-password] updateUserById error:",
      updateError.message,
    );
    return NextResponse.json(
      { error: "failed to update password" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
