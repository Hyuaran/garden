import { createServerClient } from "@/app/_lib/supabase/server";

import type { TossPartner } from "./auth";

export class TossApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requireActiveTossPartner(): Promise<TossPartner> {
  const supabase = await createServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new TossApiError("ログインが必要です", 401);

  const { data, error } = await supabase
    .from("toss_partners")
    .select("partner_code,partner_name,is_active")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle<TossPartner>();
  if (error) throw new TossApiError("パートナー情報を確認できません", 500);
  if (!data) throw new TossApiError("有効なトスパートナーではありません", 403);
  return data;
}

export function tossError(error: unknown) {
  if (error instanceof TossApiError) return { message: error.message, status: error.status };
  console.error("[toss-api]", error);
  return { message: error instanceof Error ? error.message : "処理に失敗しました", status: 500 };
}
