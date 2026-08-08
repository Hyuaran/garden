import { supabase } from "@/app/bloom/_lib/supabase";

export { normalizePartnerCode, toTossEmail } from "./identity";

export type TossPartner = {
  partner_code: string;
  partner_name: string;
  is_active: boolean;
};

export type PartnerSession =
  | { kind: "partner"; partnerCode: string; partnerName: string }
  | { kind: "staff"; partnerCode?: never; partnerName?: never };

export async function fetchTossPartner(userId: string): Promise<TossPartner | null> {
  const { data, error } = await supabase
    .from("toss_partners")
    .select("partner_code,partner_name,is_active")
    .eq("user_id", userId)
    .maybeSingle<TossPartner>();

  if (error) throw error;
  return data;
}

export async function fetchPartnerOrStaff(userId: string): Promise<PartnerSession | null> {
  const partner = await fetchTossPartner(userId);
  if (partner?.is_active) return { kind: "partner", partnerCode: partner.partner_code, partnerName: partner.partner_name };
  const { data, error } = await supabase.from("root_employees").select("user_id").eq("user_id", userId).maybeSingle<{ user_id: string }>();
  if (error) throw error;
  return data ? { kind: "staff" } : null;
}

