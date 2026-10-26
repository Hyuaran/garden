// 既存の画面・API の単体テストは閲覧設定なしで実行する。
// 設定の継承・拒否・管理接続・書き込みの分離は system-view-integration.test.tsx で実物を検証する。
import { vi } from "vitest";
vi.mock("@/lib/auth/view-permission.server", async importOriginal => {
  const actual = await importOriginal<typeof import("../view-permission.server")>();
  const { createServerClient } = await import("@/app/_lib/supabase/server");
  const { resolveCanView } = await import("../view-permission");
  const context = async () => {
    const db = await createServerClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new actual.ViewPermissionError("ログインし直してください。", 401);
    const sessionQuery = typeof db.from === "function" ? db.from("root_employees").select("garden_role").eq("user_id", user.id).eq("is_active", true) : null;
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const query = sessionQuery ?? getSupabaseAdmin().from("root_employees").select("garden_role").eq("user_id", user.id);
    const { data } = await (typeof query.is === "function" ? query.is("deleted_at", null) : query).maybeSingle();
    return { db, userId: user.id, name: "テスト利用者", viewer: { employeeId: "EMP-TEST", role: data?.garden_role ?? "staff" } };
  };
  return { ...actual, viewPermissionContext: context, readViewPermissions: async () => [],
    canView: async (...args: Parameters<typeof actual.canView>) => resolveCanView([], ...args),
    canViewSystemMenu: async (_page: string, viewer: { role: string }, defaultAllowed: boolean) => viewer.role === "super_admin" || defaultAllowed,
    requireSystemView: async () => context(), systemViewResponse: async () => null };
});
vi.mock("@/lib/auth/system-view-api.server", async () => {
  const defaults = await import("@/app/system/mypage/_lib/submission-server");
  return { requireViewEmployee: async (page: string, _tab: string, role: string) => {
    if (page === "system-list") {
      const { viewPermissionContext } = await import("../view-permission.server");
      const { isRoleAtLeast } = await import("@/app/root/_constants/types");
      const context = await viewPermissionContext();
      return isRoleAtLeast(context.viewer.role, role as "staff") ? { userId: context.userId, employee_id: context.viewer.employeeId } : null;
    }
    const name = `require${role[0].toUpperCase()}${role.slice(1)}` as keyof typeof defaults;
    return defaults[name]();
  } };
});
