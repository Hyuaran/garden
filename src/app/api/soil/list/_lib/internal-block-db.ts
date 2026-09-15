import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const INTERNAL_BLOCK_TABLE = "soil_list_internal_block";

export async function setPhoneInternalBlock(phoneNumber: string, blocked: boolean) {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from(SOIL_LIST_TABLES.phone)
    .update({ 自社アポ禁: blocked })
    .eq("電話番号", phoneNumber);
  if (error) throw new Error("電話番号台帳を更新できませんでした");
}

export async function setPhoneInternalBlockMany(phoneNumbers: string[], blocked: boolean) {
  const admin = getSupabaseAdmin();
  for (let index = 0; index < phoneNumbers.length; index += 1000) {
    const chunk = phoneNumbers.slice(index, index + 1000);
    if (chunk.length === 0) continue;
    const { error } = await admin
      .from(SOIL_LIST_TABLES.phone)
      .update({ 自社アポ禁: blocked })
      .in("電話番号", chunk);
    if (error) throw new Error("電話番号台帳を更新できませんでした");
  }
}

export async function hasActiveInternalBlock(phoneNumber: string, exceptId?: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from(INTERNAL_BLOCK_TABLE)
    .select("id", { head: false })
    .eq("電話番号", phoneNumber)
    .is("解除日", null)
    .limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) throw new Error("自社アポ禁を確認できませんでした");
  return (data?.length ?? 0) > 0;
}

export async function activeInternalBlockPhones(phoneNumbers: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  const admin = getSupabaseAdmin();
  for (let index = 0; index < phoneNumbers.length; index += 1000) {
    const chunk = phoneNumbers.slice(index, index + 1000);
    if (chunk.length === 0) continue;
    const { data, error } = await admin
      .from(INTERNAL_BLOCK_TABLE)
      .select("電話番号")
      .in("電話番号", chunk)
      .is("解除日", null);
    if (error) throw new Error("自社アポ禁を確認できませんでした");
    for (const row of (data ?? []) as unknown as Array<{ 電話番号: string }>) result.add(row.電話番号);
  }
  return result;
}
