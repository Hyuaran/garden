import "server-only";
import { onboardingAdminContext } from "./onboarding-admin.server";
import { OnboardingError } from "./onboarding.server";
import { parseTemplateValues } from "./onboarding-admin-templates";

export async function readAdminTemplates() {
  const context = await onboardingAdminContext(true);
  if (!context.canWrite) throw new OnboardingError("事務入力の権限がありません", 403);
  const { data, error } = await context.supabase.from("system_onboarding_admin_templates").select("*").order("sort_order").order("name");
  if (error) throw new OnboardingError("ひな形を読み込めませんでした", 503);
  return data ?? [];
}

export async function saveAdminTemplate(raw: unknown) {
  const context = await onboardingAdminContext();
  if (!context.sensitive) throw new OnboardingError("全権管理者だけが変更できます", 403);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new OnboardingError("ひな形を確認してください", 400);
  const input = raw as Record<string, unknown>;
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id) || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 || !Number.isSafeInteger(input.sort_order) || typeof input.updated_at !== "string") throw new OnboardingError("ひな形を確認してください", 400);
  const values = parseTemplateValues(input.values);
  const { data, error } = await context.supabase.from("system_onboarding_admin_templates")
    .update({ name: input.name.trim(), sort_order: input.sort_order, values, updated_at: new Date().toISOString() })
    .eq("id", input.id).eq("updated_at", input.updated_at).select().maybeSingle();
  if (error) throw new OnboardingError("ひな形を保存できませんでした", 503);
  if (!data) throw new OnboardingError("ほかの方が更新しました。ひな形を読み直してください", 409);
  return data;
}
