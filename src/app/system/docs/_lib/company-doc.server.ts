import "server-only";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { showsMemberField, visibleMembers } from "../_data/members";

export const PHOTO_URL_LIFETIME = 60 * 60;

// Layoutだけに頼らず、各ページと写真取得の直前で在籍中のログインユーザーを検証する。
export async function requireDocsUser(returnTo = "/system/docs") {
  const supabase = await createServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  const { data: employee, error } = await supabase.from("root_employees")
    .select("employee_id").eq("user_id", auth.user.id)
    .eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (error || !employee) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return supabase;
}

export async function loadCompanyMembers() {
  await requireDocsUser("/system/docs/company");
  const members = visibleMembers();
  const photos: Record<string, string> = {};
  // バケットを公開せず、認証・在籍確認後のサーバーでのみ署名する。
  // パスは承認済みデータから生成し、利用者指定のパスや非表示の人物にはアクセスしない。
  await Promise.all(members.filter(member => showsMemberField(member, "photo")).map(async member => {
    try {
      const { data, error } = await getSupabaseAdmin().storage.from("system-docs")
        .createSignedUrl(`company/members/${member.id}.webp`, PHOTO_URL_LIFETIME);
      if (!error && data?.signedUrl) photos[member.id] = data.signedUrl;
    } catch {
      // 写真が取得できなくても本文は表示し、写真部分だけイニシャルにする。
    }
  }));
  return { members, photos };
}
