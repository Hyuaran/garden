import { createServerClient } from "@/app/_lib/supabase/server";

import type { TossPartner } from "./auth";

export type PartnerOrStaff =
  | { kind: "partner"; partnerCode: string }
  | { kind: "staff"; name?: string; tossPartnerCode?: string };

export class TossApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requirePartnerOrStaff(): Promise<PartnerOrStaff> {
  const supabase = await createServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new TossApiError("ログインが必要です", 401);

  const { data, error } = await supabase
    .from("toss_partners")
    .select("partner_code,partner_name,is_active")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle<TossPartner>();
  if (error) throw new TossApiError("利用者情報を確認できません", 500);
  if (data) return { kind: "partner", partnerCode: data.partner_code };

  const { data: staff, error: staffError } = await supabase
    .from("root_employees").select("user_id,name,toss_partner_code").eq("user_id", auth.user.id).maybeSingle<{ user_id: string; name: string | null; toss_partner_code: string | null }>();
  if (staffError) throw new TossApiError("社員情報を確認できません", 500);
  if (staff) return {
    kind: "staff",
    ...(staff.name ? { name: staff.name } : {}),
    ...(staff.toss_partner_code?.trim() ? { tossPartnerCode: staff.toss_partner_code.trim() } : {}),
  };
  throw new TossApiError("外注ポータルを利用できません", 403);
}

/** @deprecated 新規コードは requirePartnerOrStaff を使用する。 */
export const requireActiveTossPartner = requirePartnerOrStaff;

export function tossError(error: unknown) {
  if (error instanceof TossApiError) return { message: error.message, status: error.status };
  console.error("[toss-api]", error);
  return { message: error instanceof Error ? error.message : "処理に失敗しました", status: 500 };
}
