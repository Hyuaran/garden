import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ROOT_VIEW_SCOPES, rootPageKey } from "./root-view-scopes";
import { GARDEN_ROLE_ORDER, ROOT_VIEW_ROLES, ROOT_WRITE_ROLES, type GardenRole } from "@/app/root/_constants/types";
import { resolveCanView, type ViewPermission } from "./view-permission";

const state = vi.hoisted(() => ({ role: "toss" as GardenRole, rows: [] as ViewPermission[], reads: [] as string[], selects: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "USER" } } }) },
  from: (table: string) => {
    const result = () => ({ data: table === "system_view_permissions" ? state.rows : { employee_id: "EMP-1", name: "本人", garden_role: state.role, is_active: true, deleted_at: null, termination_date: null }, error: null });
    const q = { select: () => q, eq: () => q, is: () => q, maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return q;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: (table: string) => {
  state.reads.push(table);
  const q = { select: (fields: string) => { state.selects.push(fields); return q; }, order: () => q, eq: () => q, is: () => q, limit: () => q, range: () => q, gte: () => q, lt: () => q,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ name: "許可後のデータ" }], error: null }).then(resolve) };
  return q;
} }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));
// RootView の UI はここではサーバー判定だけを検証する。
vi.mock("@/app/system/_components/ViewPermissionButton/SystemViewContext", () => ({ SystemViewProvider: () => null }));

import { canView } from "./view-permission.server";
import { rootViewNavigation, RootView } from "./root-view.server";
import { GET } from "@/app/api/root/view-data/route";
import { POST as writeEmployee } from "@/app/api/root/employees/route";
import { GET as readContracts } from "@/app/api/root/contracts/route";
import { GET as readInbox } from "@/app/api/root/inbox/route";
import { GET as readBankCheck } from "@/app/api/root/bank-check/route";
vi.mock("@/app/root/contracts/_lib/employment-contract-generation.server", () => ({ generateEmploymentContractPdf: vi.fn() }));
vi.mock("@/app/system/mypage/_lib/submission-kintone.server", () => ({ syncSubmissionToKintone: vi.fn() }));
vi.mock("@/app/system/mypage/_lib/todoke-generation.server", () => ({ generateSubmissionPdf: vi.fn() }));
vi.mock("@/app/api/root/bank-check/_lib", () => ({ runBankAccountCheck: async (db: { from: (table: string) => unknown }) => { db.from("bank-check"); return { findings: [], datasets: [] }; } }));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireAdmin: async () => ROOT_WRITE_ROLES.includes(state.role) ? { employee_id: "EMP-1" } : null }));

const setting = (page: string, roles: GardenRole[] = [], ids: string[] = []): ViewPermission => ({ page_key: page, tab_key: "", roles, employee_ids: ids, viewers_can_add: false, updated_by: "ADMIN", updated_at: "2026-10-26T00:00:00Z" });
beforeEach(() => { state.role = "toss"; state.rows = []; state.reads = []; state.selects = []; });

describe("Root の13画面", () => {
  for (const scope of ROOT_VIEW_SCOPES) {
    it(`${scope.pageKey}: 8役職の従来の入口・拡張・制限・個人指定`, async () => {
      const oldRoles = ["root-bank-check", "root-kot-sync-history"].includes(scope.pageKey) ? ROOT_WRITE_ROLES : ROOT_VIEW_ROLES;
      for (const role of GARDEN_ROLE_ORDER) {
        state.role = role;
        const viewer = { role, employeeId: "EMP-1" };
        expect(resolveCanView([], scope.pageKey, "", viewer)).toBe(oldRoles.includes(role));
        expect(await canView(scope.pageKey, "", viewer)).toBe(oldRoles.includes(role));
        expect(resolveCanView([setting(scope.pageKey, [role])], scope.pageKey, "", viewer)).toBe(true);
        expect(resolveCanView([setting(scope.pageKey, [], ["EMP-1"])], scope.pageKey, "", viewer)).toBe(true);
        expect(resolveCanView([setting(scope.pageKey)], scope.pageKey, "", viewer)).toBe(role === "super_admin");
        expect(ROOT_WRITE_ROLES.includes(role)).toBe(["admin", "super_admin"].includes(role));
      }
    });
  }
  it("未知の画面・タブ、login を拒否する", async () => {
    const viewer = { role: "super_admin" as const, employeeId: "EMP-1" };
    expect(await canView("root-unknown", "", viewer)).toBe(false);
    expect(await canView("root-employees", "unknown", viewer)).toBe(false);
    expect(rootPageKey("/root/login")).toBeUndefined();
    expect(rootPageKey("/root")).toBe("root-home");
  });
  it("navigation とURL直打ちが拡張・制限を反映する", async () => {
    state.rows = [setting("root-companies", [], ["EMP-1"])];
    expect((await rootViewNavigation())["root-companies"]).toBe(true);
    expect((await rootViewNavigation())["root-employees"]).toBe(false);
    const allowed = await RootView({ pageKey: "root-companies", children: "データ" });
    expect(allowed.props.children).toBe("データ");
    state.rows = [setting("root-companies")];
    state.role = "manager";
    expect((await rootViewNavigation())["root-companies"]).toBe(false);
    const denied = await RootView({ pageKey: "root-companies", children: "データ" });
    expect(denied.type).toBe("main");
  });
  for (const [page, dataset] of [["employees", "employees"], ["companies", "companies"], ["vendors", "vendors"], ["bank-accounts", "bank-accounts"], ["salary-systems", "salary-systems"], ["insurance", "insurance"], ["attendance", "attendance"], ["permissions", "employees"], ["kot-sync-history", "sync-logs"]]) {
    it(`${page}: API は許可後に管理者接続で読み、制限時はDBを読まない`, async () => {
      const request = () => new Request(`https://garden.test/api/root/view-data?page=root-${page}&dataset=${dataset}`);
      expect((await GET(request())).status).toBe(403);
      expect(state.reads).toEqual([]);
      state.rows = [setting(`root-${page}`, [], ["EMP-1"])];
      expect((await GET(request())).status).toBe(200);
      expect(state.reads).toHaveLength(1);
      state.reads = [];
      state.rows = [setting(`root-${page}`)]; state.role = "admin";
      expect((await GET(request())).status).toBe(403);
      expect(state.reads).toEqual([]);
    });
  }
  it("権限一覧の許可では給与口座や別画面の全件データを返さない", async () => {
    state.rows = [setting("root-permissions", [], ["EMP-1"])];
    expect((await GET(new Request("https://garden.test/api/root/view-data?page=root-permissions&dataset=employees"))).status).toBe(200);
    expect(state.selects[0]).not.toContain("account_number");
    expect((await GET(new Request("https://garden.test/api/root/view-data?page=root-permissions&dataset=bank-accounts"))).status).toBe(403);
    expect((await GET(new Request("https://garden.test/api/root/view-data?page=__proto__&dataset=toString"))).status).toBe(403);
  });
  for (const [key, handler] of [["root-contracts", readContracts], ["root-inbox", readInbox], ["root-bank-check", readBankCheck]] as const) {
    it(`${key}: 既存データAPIも拡張と制限を反映する`, async () => {
      const request = new Request("https://garden.test/api/root");
      expect((await handler(request)).status).toBe(403);
      expect(state.reads).toEqual([]);
      state.rows = [setting(key, [], ["EMP-1"])];
      expect((await handler(request)).status).toBe(200);
      expect(state.reads.length).toBeGreaterThan(0);
      state.reads = []; state.rows = [setting(key)]; state.role = "admin";
      expect((await handler(request)).status).toBe(403);
      expect(state.reads).toEqual([]);
    });
  }
  it("閲覧を広げても従業員の書き込みは403のまま", async () => {
    state.rows = [setting("root-employees", [], ["EMP-1"])];
    const response = await writeEmployee(new Request("https://garden.test/api/root/employees", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
    expect(state.reads).toEqual([]);
  });
  it("migration はRoot画面の既定と一致し、未知key拒否のRPCを維持する", () => {
    const sql = readFileSync("supabase/migrations/20261026000006_root_view_scopes.sql", "utf8") + readFileSync("supabase/migrations/20261027000451_root_minimum_wages.sql", "utf8");
    for (const scope of ROOT_VIEW_SCOPES) {
      const line = sql.split("\n").find(line => line.includes(`'${scope.pageKey}'`))!;
      expect(line).toBeTruthy();
      expect(line).toContain(`array[${scope.defaultRoles.map(role => `'${role}'`).join(",")}]`);
    }
    const base = readFileSync("supabase/migrations/20261026000005_system_view_scopes.sql", "utf8");
    expect(base).toContain("raise exception 'unknown scope'");
    const rpc = readFileSync("supabase/migrations/20261026000002_system_view_permissions.sql", "utf8");
    expect(rpc.match(/perform public.system_view_default_roles\(p_page,p_tab\)/g)).toHaveLength(3);
  });
});
