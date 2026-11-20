import "server-only";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, type Submission } from "./submissions";
import { kandenOpen } from "./rollout";

export async function formEmployee() {
  const context = await requireSystemView("system-forms-kanden");
  if (!isRoleAtLeast(context.viewer.role, "staff")) throw new Error("社員のみ送信できます。");
  if (!kandenOpen(context.viewer.role)) throw new Error("2026年12月1日から使えます。");
  return employeeRecord(context);
}

export async function employeeRecord(context: Awaited<ReturnType<typeof requireSystemView>>) {
  const { data, error } = await context.db.from("root_employees")
    .select("employee_id,employee_number").eq("user_id", context.userId).eq("is_active", true).single();
  if (error || !data) throw new Error("送信者の情報を読み込めませんでした。");
  // root_employees の主キーは employee_id（文字列）
  return { id: String(data.employee_id), number: String(data.employee_number ?? ""), name: context.name };
}

const columns = "id,set_id,kanri_no,kanri_no_raw,employee_name,acquisition,customer_name,has_denki,has_douryoku,has_gas,urgent_sw,sw_month,note,specs_status,submitted_at,updated_at,leaf_kanden_photo_sets(photo_count)";
type JoinedSubmission = Omit<Submission, "photo_count"> & { leaf_kanden_photo_sets: { photo_count: number } };

function submissionsQuery() {
  return getSupabaseAdmin().from("leaf_kanden_submissions").select(columns)
    .order("submitted_at", { ascending: false }).order("id", { ascending: false });
}

function unpack(data: unknown): Submission[] {
  return (data as JoinedSubmission[]).map(({ leaf_kanden_photo_sets, ...row }) => ({
    ...row, photo_count: leaf_kanden_photo_sets.photo_count,
  }));
}

export async function recentSubmissions(employeeId: string) {
  const { data, error } = await submissionsQuery().eq("employee_id", employeeId).limit(10);
  if (error) throw error;
  return unpack(data);
}

export async function submissionsForYear(year: number) {
  const rows: Submission[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await submissionsQuery()
      .gte("submitted_at", `${year}-04-01T00:00:00+09:00`)
      .lt("submitted_at", `${year + 1}-04-01T00:00:00+09:00`)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...unpack(data));
    if (data.length < pageSize) return rows;
  }
}

export async function submissionDetail(id: string) {
  const { data, error } = await submissionsQuery().eq("id", id);
  if (error || !data.length) throw error ?? new Error("Submission not found");
  return unpack(data)[0];
}

export async function signCasePhotos(paths: string[], name: string, offset = 0) {
  if (!paths.length) return [];
  const { data, error } = await getSupabaseAdmin().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data || data.length !== paths.length) throw error ?? new Error("Image signing failed");
  return data.map((photo, index) => {
    if (photo.error || !photo.signedUrl) throw new Error("Image signing failed");
    return { url: photo.signedUrl, filename: `${name}_${offset + index + 1}.jpg`, jpeg: /\.jpe?g$/i.test(paths[index]) };
  });
}
