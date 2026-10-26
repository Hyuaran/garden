import { buildPermissionMatrix, buildRoleSummary } from "@/lib/auth/permission-registry";
import PermissionsClient from "./PermissionsClient";
import { readViewPermissions } from "@/lib/auth/view-permission.server";
import { effectivePermission, permissionEntry } from "@/lib/auth/view-permission";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PERMISSION_ENTRIES } from "@/lib/auth/permission-registry";

export const metadata = {
  title: "権限一覧 | Garden Root",
};

export default async function PermissionsPage() {
  const settings = await readViewPermissions();
  const ids = [...new Set(settings.map(row => row.updated_by))];
  const { data: people } = ids.length ? await getSupabaseAdmin().from("root_employees").select("employee_id,name").in("employee_id", ids) : { data: [] };
  const rows = buildPermissionMatrix().map(row => {
    const entry = PERMISSION_ENTRIES.find(item => item.key === row.key)!;
    const setting = entry.pageKey ? effectivePermission(settings, entry.pageKey, entry.tabKey) : undefined;
    if (!setting || !permissionEntry(entry.pageKey!, entry.tabKey)) return row;
    const name = people?.find(person => person.employee_id === setting.updated_by)?.name ?? setting.updated_by;
    return { ...row, label: `${row.label} — 設定で変更あり（${name}さん ${new Date(setting.updated_at).toLocaleDateString("ja-JP", {timeZone:"Asia/Tokyo"})}）`, roles: Object.fromEntries(Object.keys(row.roles).map(role => [role, role === "super_admin" || setting.roles.includes(role)])) as typeof row.roles };
  });
  return <PermissionsClient initialPermissionRows={rows} roleSummary={buildRoleSummary()} />;
}
