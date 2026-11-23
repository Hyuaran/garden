"use server";

import { createClient } from "@supabase/supabase-js";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { countUrgentSubmissions, formEmployee, ownSubmission, recentSubmissions, signCasePhotos } from "@/lib/leaf-kanden/submissions.server";
import { sendGardenNotice } from "@/lib/relay/monitor.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { digits, pdKey } from "@/lib/leaf-kanden/sales-form";
import { UUID, type ListCustomer, type SalesProfile } from "@/lib/leaf-kanden/submissions";

export async function lookupKandenPd(value: string): Promise<{ customer: ListCustomer | null } | { error: string }> {
  try {
    await formEmployee();
    const key = typeof value === "string" && value.length <= 50 && pdKey(value);
    if (!key) return { error: "PD番号を確認してください。" };
    const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_sales_lookup", {
      p_number: key.number, p_branch: key.branch,
    }).maybeSingle();
    if (error) throw error;
    if (!data) return { customer: null };
    const row = data as Record<string, string | null>;
    const number = digits(row.customer_no ?? "", 50);
    const supply = digits(row.supply_point ?? "", 50);
    return { customer: {
      name: row.customer_name ?? "", kana: row.customer_kana ?? "",
      address: [row.address1, row.address2].join(""), phone: row.phone1 || row.phone2 || row.mobile || "",
      number: number.length === 14 ? number : "", supply: supply.length === 22 ? supply : "",
      contract: row.contract_type ?? "", listName: row.list_name ?? "", outside: false,
    } };
  } catch {
    return { error: "リストを照合できませんでした。もう一度お試しください。" };
  }
}

export async function loadSalesProfile(): Promise<SalesProfile | null> {
  try {
    const employee = await formEmployee();
    const db = getSupabaseAdmin();
    const [profile, month] = await Promise.all([
      db.from("root_employees").select("name_kana,hire_date,email").eq("employee_id", employee.id).single(),
      db.rpc("leaf_kanden_sales_month", { p_employee: employee.id }).single(),
    ]);
    if (profile.error || month.error) return null;
    const stats = month.data as Omit<SalesProfile, "kana" | "hireDate" | "email">;
    return { kana: profile.data.name_kana, hireDate: profile.data.hire_date, email: profile.data.email, ...stats };
  } catch {
    return null;
  }
}

export async function loadSalesCases(offset: number, urgent = false) {
  try {
    const employee = await formEmployee();
    if (!Number.isSafeInteger(offset) || offset < 0) return null;
    const [rows, urgentCount] = await Promise.all([
      recentSubmissions(employee.id, offset, 50, urgent === true),
      countUrgentSubmissions(employee.id),
    ]);
    return { rows, urgentCount };
  } catch {
    return null;
  }
}

export async function findSalesCase(id: string) {
  try {
    const employee = await formEmployee();
    if (typeof id !== "string" || !UUID.test(id)) return { error: "案件番号を確認してください。" };
    const row = await ownSubmission(id, employee.id);
    if (!row) return { error: "自分の送信にこの案件番号は見つかりませんでした。" };
    return { row };
  } catch {
    return { error: "案件を確認できませんでした。もう一度お試しください。" };
  }
}

export async function loadSalesPhotos(id: string) {
  try {
    const employee = await formEmployee();
    if (typeof id !== "string" || !UUID.test(id)) throw new Error();
    const db = getSupabaseAdmin();
    const submission = await db.from("leaf_kanden_submissions").select("set_id")
      .eq("id", id).eq("employee_id", employee.id).single();
    if (submission.error) throw submission.error;
    const { data, error } = await db.from("leaf_kanden_photos").select("image_path,category")
      .eq("set_id", submission.data.set_id).order("image_path");
    if (error) throw error;
    const photos = await signCasePhotos(data.map(row => row.image_path), "関電");
    return { photos: photos.map(({ url }, index) => ({ url, category: data[index].category })) };
  } catch {
    return { error: "写メを読み込めませんでした。" };
  }
}

export async function submitKandenInfoUpdate(value: string) {
  try {
    const employee = await formEmployee();
    if (typeof value !== "string" || !value.trim() || value.length > 2000) return { error: "変更内容を入力してください（2000文字まで）。" };
    const body = `関電営業フォームの情報更新申請\n申請者　${employee.name}（${employee.number}）\n${value.trim()}`.replaceAll("[", "［");
    if (await sendGardenNotice(body, AbortSignal.timeout(8_000))) return { ok: true };
  } catch {
    // Keep the request in the dialog so the employee can retry.
  }
  return { error: "情報更新の申請を送信できませんでした。" };
}

export async function unlockKandenForm(password: string) {
  try {
    await formEmployee();
    if (typeof password !== "string" || !password || password.length > 256) return false;
    const context = await requireSystemView("system-forms-kanden");
    const { data: { user } } = await context.db.auth.getUser();
    if (!user?.email) return false;
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
    if (data.session) await client.auth.signOut({ scope: "local" });
    return !error && data.user?.id === context.userId;
  } catch {
    return false;
  }
}
