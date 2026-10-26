import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { GARDEN_ROLE_ORDER } from "@/app/root/_constants/types";
import { PERMISSION_ENTRIES } from "@/lib/auth/permission-registry";
import { effectivePermission, permissionEntry, resolveCanView } from "@/lib/auth/view-permission";
import { readViewPermissions, viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
import { notifyViewerAdded } from "@/lib/auth/view-permission-notice.server";
import { tokyoDateString } from "@/lib/auth/employee-access";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return Response.json({ error: error instanceof ViewPermissionError ? error.message : "閲覧設定を処理できませんでした。" }, { status: error instanceof ViewPermissionError ? error.status : 500, headers });
}
function scope(page: unknown, tab: unknown) {
  if (typeof page !== "string" || typeof tab !== "string" || !permissionEntry(page, tab)) throw new ViewPermissionError("対象を確認してください。", 400);
  return { page, tab };
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { page, tab } = scope(url.searchParams.get("page"), url.searchParams.get("tab") ?? "");
    const context = await viewPermissionContext();
    const settings = await readViewPermissions();
    const admin = context.viewer.role === "super_admin";
    const effective = effectivePermission(settings, page, tab);
    if (!admin && !(effective?.viewers_can_add && resolveCanView(settings, page, tab, context.viewer))) throw new ViewPermissionError("閲覧権限がありません");
    const db = getSupabaseAdmin();
    const employees = await db.from("root_employees").select("employee_id,name,name_kana").eq("is_active", true).is("deleted_at", null).or(`termination_date.is.null,termination_date.gt.${tokyoDateString()}`).order("name");
    if (employees.error) throw employees.error;
    const rows = settings.filter(row => row.page_key === page);
    const updaterIds = [...new Set(rows.map(row => row.updated_by))];
    const updaters = updaterIds.length ? await db.from("root_employees").select("employee_id,name").in("employee_id", updaterIds) : { data: [], error: null };
    if (updaters.error) throw updaters.error;
    return Response.json({ settings: rows, employees: employees.data, updaters: updaters.data, defaults: Object.fromEntries(PERMISSION_ENTRIES.filter(entry => entry.pageKey === page).map(entry => [entry.tabKey, GARDEN_ROLE_ORDER.filter(role => entry.allows(role))])) }, { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site" || (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) throw new ViewPermissionError("この画面から操作してください。");
    const context = await viewPermissionContext();
    let body;
    try { body = await request.json(); } catch { throw new ViewPermissionError("設定内容を確認してください。", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ViewPermissionError("設定内容を確認してください。", 400);
    const { page, tab } = scope(body.page, body.tab);
    if (!["save", "reset", "add"].includes(body.action)) throw new ViewPermissionError("操作を確認してください。", 400);
    if (body.action !== "add" && context.viewer.role !== "super_admin") throw new ViewPermissionError("設定を変更する権限がありません");
    if (body.action === "add") {
      const settings = await readViewPermissions();
      if (context.viewer.role !== "super_admin" && !(effectivePermission(settings, page, tab)?.viewers_can_add && resolveCanView(settings, page, tab, context.viewer))) throw new ViewPermissionError("人を追加する権限がありません");
      if (typeof body.employeeId !== "string" || body.employeeId.length > 100) throw new ViewPermissionError("追加する人を確認してください。", 400);
      const { data, error } = await context.db.rpc("system_add_viewer", { p_page: page, p_tab: tab, p_employee_id: body.employeeId });
      if (error) throw new ViewPermissionError("追加できませんでした。権限と在籍状況を確認してください。", error.code === "42501" ? 403 : 409);
      let warning;
      if (data === true) {
        const target = await getSupabaseAdmin().from("root_employees").select("name").eq("employee_id", body.employeeId).single();
        try { await notifyViewerAdded(context.name, String(target.data?.name ?? body.employeeId), permissionEntry(page, tab)!.label.replace("：", "／")); }
        catch { warning = "追加しましたが、Garden通知を送れませんでした。"; }
      }
      return Response.json({ ok: true, warning }, { headers });
    }
    if (body.action === "save" && (!Array.isArray(body.roles) || !body.roles.every((r: unknown) => GARDEN_ROLE_ORDER.includes(r as typeof GARDEN_ROLE_ORDER[number])) || !Array.isArray(body.employeeIds) || body.employeeIds.length > 2000 || !body.employeeIds.every((id: unknown) => typeof id === "string" && id.length <= 100) || typeof body.viewersCanAdd !== "boolean")) throw new ViewPermissionError("設定内容を確認してください。", 400);
    const before = body.action === "save" ? effectivePermission(await readViewPermissions(), page, tab)?.employee_ids ?? [] : [];
    const args = { p_page: page, p_tab: tab };
    const result = body.action === "reset" ? await context.db.rpc("system_reset_view_permission", args)
      : await context.db.rpc("system_save_view_permission", { ...args, p_roles: body.roles, p_employee_ids: body.employeeIds, p_viewers_can_add: body.viewersCanAdd });
    if (result.error) throw new ViewPermissionError("保存できませんでした。設定内容を確認してください。", result.error.code === "42501" ? 403 : 409);
    let warning;
    if (body.action === "save") {
      for (const id of (body.employeeIds as string[]).filter(id => !before.includes(id))) {
        const target = await getSupabaseAdmin().from("root_employees").select("name").eq("employee_id", id).single();
        try { await notifyViewerAdded(context.name, String(target.data?.name ?? id), permissionEntry(page, tab)!.label.replace("：", "／")); }
        catch { warning = "保存しましたが、Garden通知を送れませんでした。"; }
      }
    }
    return Response.json({ ok: true, warning }, { headers });
  } catch (error) { return failure(error); }
}
