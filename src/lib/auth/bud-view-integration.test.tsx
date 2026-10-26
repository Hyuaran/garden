import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BUD_VIEW_SCOPES, budPageKey } from "./bud-view-scopes";
import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { permissionEntry, type ViewPermission } from "./view-permission";
import { validBudRead } from "./bud-view-data";
import { filterBudViewHtml } from "./bud-view-html";

const state = vi.hoisted(() => ({ role: "staff" as GardenRole, registered: true, rows: [] as ViewPermission[], active: true, loggedIn: true, error: null as null | { code: string } }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.loggedIn ? { id: "USER" } : null } }), getSession: async () => ({ data: { session: { access_token: "USER-TOKEN" } } }) },
  rpc: async () => ({ data: state.registered || ["admin", "super_admin"].includes(state.role), error: null }),
  from: (table: string) => {
    const result = () => ({ data: table === "system_view_permissions" ? state.rows : { employee_id: "EMP-1", name: "本人", garden_role: state.role, is_active: state.active, deleted_at: null, termination_date: null }, error: table === "system_view_permissions" ? state.error : null });
    const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  },
}) }));
vi.mock("@/app/system/_components/ViewPermissionButton/SystemViewContext", () => ({ SystemViewProvider: () => null }));
vi.mock("@/app/bud/_components/BudViewChrome", () => ({ BudViewChrome: () => null }));
import { canViewBud, budViewNavigation, budViewResponse, budWriteResponse, BudView } from "./bud-view.server";
import { GET } from "@/app/api/bud/view-data/route";

function setting(page: string, tab = "", roles: GardenRole[] = [], ids: string[] = []): ViewPermission {
  return { page_key: page, tab_key: tab, roles, employee_ids: ids, viewers_can_add: false, updated_by: "ADMIN", updated_at: "2026-10-26" };
}
beforeEach(() => {
  state.role = "staff"; state.registered = true; state.active = true; state.loggedIn = true; state.rows = []; state.error = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
});

describe("Bud の全画面・タブ", () => {
  for (const scope of BUD_VIEW_SCOPES) {
    it(`${scope.pageKey}/${scope.tabKey}: 8役職×Bud登録有無の従来の入口・役職/個人の拡張・制限`, async () => {
      for (const role of GARDEN_ROLE_ORDER) for (const registered of [false, true]) {
        state.role = role; state.registered = registered; state.rows = [];
        const original = isRoleAtLeast(role, "staff") && (registered || ["admin", "super_admin"].includes(role)) && (scope.tabKey !== "deleted" || role === "super_admin");
        expect(await canViewBud(scope.pageKey, scope.tabKey)).toBe(original);
        state.rows = [setting(scope.pageKey, scope.tabKey, [role])];
        expect(await canViewBud(scope.pageKey, scope.tabKey)).toBe(true);
        expect((await budWriteResponse()) === null).toBe(isRoleAtLeast(role, "staff") && (registered || ["admin", "super_admin"].includes(role)));
        state.rows = [setting(scope.pageKey, scope.tabKey, [], ["EMP-1"])];
        expect(await canViewBud(scope.pageKey, scope.tabKey)).toBe(true);
        state.rows = [setting(scope.pageKey, scope.tabKey)];
        expect(await canViewBud(scope.pageKey, scope.tabKey)).toBe(role === "super_admin");
      }
    });
  }
  it("タブ→画面→既定・個人指定・サイドバーとURL直打ちが一致する", async () => {
    state.rows = [setting("bud-transfers"), setting("bud-transfers", "approval", [], ["EMP-1"])];
    expect(await canViewBud("bud-transfers", "overview")).toBe(false);
    expect(await canViewBud("bud-transfers", "approval")).toBe(true);
    expect((await budViewNavigation())["bud-transfers"]).toBe(true);
    expect((await BudView({ pageKey: "bud-transfers", children: "本文" })).type).not.toBe("main");
    state.rows = [setting("bud-transfers")];
    expect((await budViewNavigation())["bud-transfers"]).toBe(false);
    expect((await BudView({ pageKey: "bud-transfers", children: "本文" })).type).toBe("main");
  });
  it("未登録・ログイン・既存の口座残高/事業の収支は新scopeに登録しない", async () => {
    for (const path of ["/bud/login", "/bud/bank", "/bud/bank/accounts/1", "/bud/profit/broadband", "/bud/profit/broadband/1"]) expect(budPageKey(path)).toBeUndefined();
    expect(budPageKey("/bud/shiwakechou")).toBe("bud-journal");
    expect(permissionEntry("bud-bank")).toBeUndefined(); expect(permissionEntry("bud-broadband")).toBeUndefined();
    state.role = "super_admin";
    expect(await canViewBud("bud-unknown", "")).toBe(false);
    expect(await canViewBud("bud-expenses", "unknown")).toBe(false);
  });
  it("未ログイン・退職者・設定読取障害は失敗として閉じる", async () => {
    state.loggedIn = false; expect((await budViewResponse("bud-expenses"))?.status).toBe(401);
    state.loggedIn = true; state.active = false; expect((await budViewResponse("bud-expenses"))?.status).toBe(403);
    state.active = true; state.error = { code: "NETWORK" }; expect((await budViewResponse("bud-expenses"))?.status).toBe(503);
  });
});

describe("データ API と書き込みの分離", () => {
  const request = (page = "bud-transfers", table = "bud_transfers", tab?: string, query = "select=*") => new Request(`https://garden.test/api/bud/view-data?${new URLSearchParams({ page, table, query, ...(tab ? { tab } : {}) })}`);
  it("拡張後だけ管理者接続で読み、制限したAPIは403でデータを読まない", async () => {
    state.role = "toss"; state.registered = false;
    expect((await GET(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
    state.rows = [setting("bud-transfers", "", [], ["EMP-1"])];
    expect((await GET(request())).status).toBe(200);
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer test-service");
    expect((await budWriteResponse())?.status).toBe(403);
    state.rows.push(setting("bud-transfers", "approval"));
    vi.mocked(fetch).mockClear(); expect((await GET(request("bud-transfers", "bud_transfers", "approval"))).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it("マスタだけの許可では振込データを返さない", async () => {
    state.rows = [setting("bud-transfers"), setting("bud-transfers", "master", ["staff"])];
    expect((await GET(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it("非許可の経費状態・削除済み行をサーバーで制限する", async () => {
    state.rows = [setting("bud-expenses"), setting("bud-expenses", "approve", ["staff"])];
    expect((await GET(request("bud-expenses", "bud_expense_requests"))).status).toBe(200);
    const target = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(target.searchParams.get("and")).toBe("(and(deleted_at.is.null,status.in.(final_pending)))");
    expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Headers).get("authorization")).toBe("Bearer USER-TOKEN");
  });
  it("未知のデータ・JOIN・重複パラメータ・従業員の機微情報は拒否", () => {
    for (const [page, table, query] of [["bud-transfers", "root_employees", "select=*"], ["bud-expenses", "root_employees", "select=*&employee_id=eq.1"], ["bud-expenses", "root_employees", "select=name&select=*&employee_id=eq.1"], ["bud-expenses", "bud_expense_requests", "select=*,root_employees(*)"], ["bud-statements", "bud_transfers", "select=*"], ["bud-expenses", "bud_expense_requests", "and=(id.not.is.null)"]]) expect(validBudRead(page, table, new URLSearchParams(query))).toBe(false);
    expect(validBudRead("bud-expenses", "root_employees", new URLSearchParams("select=employee_id,name&employee_id=in.(EMP-1)"))).toBe(true);
  });
});

it("非許可HTMLを内容ごと取り除き、最初の許可タブへ切り替える", () => {
  const html = '<nav><button class="tab-item active" data-tab="a">A</button><button class="tab-item" data-tab="b">B</button></nav><div class="tab-content active" id="tab-a"><div>秘密</div></div><div class="tab-content" id="tab-b">公開</div>';
  const result = filterBudViewHtml(html, [{ key: "a", allowed: false }, { key: "b", allowed: true }]);
  expect(result).not.toContain("秘密"); expect(result).not.toContain('data-tab="a"'); expect(result).toContain('class="active tab-item"'); expect(result).toContain('class="active tab-content"');
});
it("migration の scope と登録が一致し、書込みRLS・既存2画面を変更しない", () => {
  const sql = readFileSync("supabase/migrations/20261026000007_bud_view_scopes.sql", "utf8");
  for (const scope of BUD_VIEW_SCOPES) expect(sql).toContain(`('${scope.pageKey}','${scope.tabKey}'`);
  expect(sql).not.toMatch(/for (insert|update|delete)|create or replace function public.bud_has_access/i);
  expect(sql).not.toMatch(/'bud-bank'|'bud-broadband'|bud_mf_group_viewers|bud_bb_viewers/);
  expect(sql).toContain("as restrictive for select"); expect(sql).toContain("termination_date");
  expect(sql).toContain("page_key not like 'bud-%' or viewers_can_add=false");
});
it("モバイルの本人申請専用APIは従来の入口のまま", () => {
  for (const path of ["expense-corporations", "expense-ocr", "expense-drive/upload"]) {
    const source = readFileSync(`src/app/api/bud/${path}/route.ts`, "utf8");
    expect(source).toContain("supabase.auth.getUser()");
    expect(source).not.toContain("budViewResponse"); expect(source).not.toContain("budWriteResponse");
  }
  const mobile = readFileSync("src/app/m/bud/submit/page.tsx", "utf8");
  expect(mobile).toContain('fetch("/api/bud/expense-corporations"');
});
