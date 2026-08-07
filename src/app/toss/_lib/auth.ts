import { supabase } from "@/app/bloom/_lib/supabase";

export { normalizePartnerCode, toTossEmail } from "./identity";

export type TossPartner = {
  partner_code: string;
  partner_name: string;
  is_active: boolean;
};

export async function fetchTossPartner(userId: string): Promise<TossPartner | null> {
  const { data, error } = await supabase
    .from("toss_partners")
    .select("partner_code,partner_name,is_active")
    .eq("user_id", userId)
    .maybeSingle<TossPartner>();

  if (error) throw error;
  return data;
}

