import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { SYSTEM_VIEW_SCOPES as ALL_SYSTEM_VIEW_SCOPES } from "./system-view-scopes";
// 開発ボードは東海林さんだけの特別な画面（役職の既定なし・歯車なし・DB の scope 表にも載せない）ので、共通の確かめからは外す
const SYSTEM_VIEW_SCOPES = ALL_SYSTEM_VIEW_SCOPES.filter(scope => scope.pageKey !== "system-dev-board");
import { permissionEntry, resolveCanView, type ViewPermission } from "./view-permission";

const state = vi.hoisted(() => ({ role: "toss" as GardenRole, rows: [] as ViewPermission[], reads: [] as string[], user: true, permissionError: null as null | { code: string } }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "USER-1" } : null } }) },
  from: (table: string) => {
    const result = () => table === "system_view_permissions" ? { data: state.rows, error: state.permissionError } : { data: { employee_id: "EMP-1", name: "本人", garden_role: state.role, is_active: true, deleted_at: null, termination_date: null }, error: null };
    const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: (table: string) => {
  state.reads.push(table);
  const query = { select: () => query, eq: () => query, order: async () => ({ data: [{ name: "閲覧できるデータ" }], error: null }),
    maybeSingle: async () => ({ data: { garden_role: state.role }, error: null }) };
  return query;
} }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));

import { canView, canViewSystemMenu, systemViewResponse, viewPermissionContext } from "./view-permission.server";
import { withSystemView } from "./system-view-page.server";
import { GET, PUT } from "@/app/api/system/kanri/people/route";
import { requireSoilListUser } from "@/app/api/soil/list/_lib/auth";

const setting = (page_key: string, tab_key = "", roles: string[] = [], employee_ids: string[] = []): ViewPermission => ({ page_key, tab_key, roles, employee_ids, viewers_can_add: false, updated_by: "ADMIN", updated_at: "2026-10-26T00:00:00Z" });
beforeEach(() => { state.role = "toss"; state.rows = []; state.reads = []; state.user = true; state.permissionError = null; });

describe("全対象の既定と継承", () => {
  for (const scope of SYSTEM_VIEW_SCOPES) {
    it(`${scope.pageKey}/${scope.tabKey}: 全8役職の既定・拡張・制限`, () => {
      for (const role of GARDEN_ROLE_ORDER) {
        const viewer = { role, employeeId: "EMP-1" };
        expect(resolveCanView([], scope.pageKey, scope.tabKey, viewer)).toBe(scope.defaultRoles.includes(role));
        expect(resolveCanView([setting(scope.pageKey, "", [], ["EMP-1"])], scope.pageKey, scope.tabKey, viewer)).toBe(true);
        expect(resolveCanView([setting(scope.pageKey, "", [role])], scope.pageKey, scope.tabKey, viewer)).toBe(true);
        expect(resolveCanView([setting(scope.pageKey, "", [role]), setting(scope.pageKey, scope.tabKey)], scope.pageKey, scope.tabKey, viewer)).toBe(scope.tabKey === "" || role === "super_admin");
      }
    });
  }
  it("入口の既定とメニューの既定の違いを設定なしで保つ", () => {
    const viewer = { role: "outsource" as const, employeeId: "EMP-1" };
    expect(resolveCanView([], "system-docs", "", viewer)).toBe(true);
    expect(resolveCanView([], "system-docs", "", viewer, false)).toBe(false);
    expect(resolveCanView([setting("system-docs", "", [], ["EMP-1"])], "system-docs", "", viewer, false)).toBe(true);
    expect(SYSTEM_VIEW_SCOPES.find(scope => scope.pageKey === "system-kanri" && !scope.tabKey)?.defaultRoles.includes("staff")).toBe(true);
    for (const role of GARDEN_ROLE_ORDER) expect(SYSTEM_VIEW_SCOPES.find(scope => scope.pageKey === "system-list" && !scope.tabKey)?.defaultRoles.includes(role)).toBe(isRoleAtLeast(role, "manager"));
  });
  it("未知の画面・タブは全権管理者にも拒否する", async () => {
    state.role = "super_admin";
    const { viewer } = await viewPermissionContext();
    expect(await canView("unknown", "", viewer)).toBe(false);
    expect(await canView("system-list", "unknown", viewer)).toBe(false);
  });
  it("サイドバーは既定の限定メニューを保ち、タブだけの許可・全タブの拒否を反映する", async () => {
    const { viewer } = await viewPermissionContext();
    expect(await canViewSystemMenu("system-list", viewer, false)).toBe(false);
    state.rows = [setting("system-list", "analysis", [], ["EMP-1"])];
    expect(await canViewSystemMenu("system-list", viewer, false)).toBe(true);
    state.role = "manager";
    const manager = (await viewPermissionContext()).viewer;
    state.rows = SYSTEM_VIEW_SCOPES.filter(scope => scope.pageKey === "system-list" && scope.tabKey).map(scope => setting(scope.pageKey, scope.tabKey));
    expect(await canViewSystemMenu("system-list", manager, true)).toBe(false);
  });
});

describe("実際のページ・API の読み取りと書き込みの分離", () => {
  it("拒否時はページ本体を実行しない", async () => {
    const body = vi.fn(() => <p>秘密の本文</p>);
    const page = withSystemView("system-list", body);
    await page();
    expect(body).not.toHaveBeenCalled();
    state.rows = [setting("system-list", "", [], ["EMP-1"])];
    await page();
    expect(body).toHaveBeenCalledOnce();
  });
  it("個人で広げると管理者接続で読めるが、保存は403のまま", async () => {
    state.rows = [setting("system-kanri", "settings", [], ["EMP-1"])];
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).people).toEqual([{ name: "閲覧できるデータ" }]);
    expect(state.reads).toContain("system_kanri_person");
    expect((await PUT(new Request("http://localhost/api/system/kanri/people", { method: "PUT", body: JSON.stringify({ people: [] }) }))).status).toBe(403);
  });
  it("責任者でも狭めたタブのAPIは403、管理データを問い合わせない", async () => {
    state.role = "manager";
    state.rows = [setting("system-kanri", "settings")];
    expect((await GET()).status).toBe(403);
    expect(state.reads).not.toContain("system_kanri_person");
  });
  it("リストの読み取りだけを広げ、書き込み認証は広げない", async () => {
    state.rows = [setting("system-list", "analysis", [], ["EMP-1"])];
    expect((await requireSoilListUser("analysis")).ok).toBe(true);
    expect((await requireSoilListUser("list")).ok).toBe(false);
    expect((await requireSoilListUser()).ok).toBe(false);
  });
  it("全対象で設定によるAPI拒否と未ログインを扱う", async () => {
    for (const scope of SYSTEM_VIEW_SCOPES) {
      state.rows = [setting(scope.pageKey, scope.tabKey)];
      expect((await systemViewResponse(scope.pageKey, scope.tabKey))?.status).toBe(403);
    }
    state.user = false;
    expect((await systemViewResponse("system-mypage"))?.status).toBe(401);
  });
  it("設定表の通信障害で既定へ戻して権限を広げない", async () => {
    state.role = "manager";
    state.permissionError = { code: "08006" };
    expect((await systemViewResponse("system-list"))?.status).toBe(503);
  });
});

it("SQL の全 scope・既定役職が registry と一致し、全変更RPCが未知keyを先に拒否する", () => {
  // 後から足した画面の scope は、その画面の migration に入っている
  const sql = readFileSync("supabase/migrations/20261026000005_system_view_scopes.sql", "utf8") + readFileSync("supabase/migrations/20261029000466_system_expense_report.sql", "utf8");
  for (const scope of SYSTEM_VIEW_SCOPES) {
    const roles = scope.defaultRoles.map(role => `'${role}'`).join(",");
    expect(sql).toContain(`('${scope.pageKey}','${scope.tabKey}','${permissionEntry(scope.pageKey, scope.tabKey)!.label}',array[${roles}]::text[])`);
  }
  expect(sql).toContain("where page_key=p_page and tab_key=p_tab");
  expect(sql).toContain("if not found then raise exception 'unknown scope' using errcode='22023'");
  const previous = readFileSync("supabase/migrations/20261026000002_system_view_permissions.sql", "utf8");
  for (const name of ["save_view_permission", "reset_view_permission", "add_viewer"]) {
    const body = previous.slice(previous.indexOf(`create function public.system_${name}`)).split("end $$;")[0];
    expect(body.indexOf("perform public.system_view_default_roles(p_page,p_tab)")).toBeLessThan(body.indexOf("select * into actor"));
  }
});
