import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { GARDEN_ROLE_ORDER, isRoleAtLeast } from "@/app/root/_constants/types";
import { MODULE_MIN_ROLES } from "@/app/_constants/module-min-roles";
import { LEAF_FOREST_PAGES, LEAF_FOREST_VIEW_SCOPES, leafForestPageKey } from "./leaf-forest-view-scopes";
import { resolveCanView, type ViewPermission, type Viewer } from "./view-permission";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ permissions: [] as ViewPermission[], viewer: { employeeId: "EMP-test", role: "staff" } as Viewer, member: false }));
vi.mock("./view-permission.server", async () => {
  const { resolveCanView } = await import("./view-permission");
  class ViewPermissionError extends Error { constructor(message: string, public status = 403) { super(message); } }
  return {
    ViewPermissionError,
    viewPermissionContext: async () => ({ viewer: mocks.viewer, userId: "user", db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.member ? { role: "viewer" } : null, error: null }) }) }) }) } }),
    canView: async (page: string, tab: string, viewer: Viewer, defaults?: boolean) => resolveCanView(mocks.permissions, page, tab, viewer, defaults),
  };
});
vi.mock("@/app/system/_components/ViewPermissionButton/SystemViewContext", () => ({ SystemViewProvider: ({ children }: { children: React.ReactNode }) => children }));
import { canViewLeafForest, requireForestDataRead, requireLeafForestRead } from "./leaf-forest-view.server";

const setting = (page: string, roles: string[], tab = "", people: string[] = []): ViewPermission => ({ page_key: page, tab_key: tab, roles, employee_ids: people, viewers_can_add: false, updated_by: "admin", updated_at: "" });
beforeEach(() => { mocks.permissions = []; mocks.viewer = { employeeId: "EMP-test", role: "staff" }; mocks.member = false; });

describe("Leaf/Soil/Seed/Fruit/Forest view permissions", () => {
  for (const scope of LEAF_FOREST_VIEW_SCOPES) for (const role of GARDEN_ROLE_ORDER) {
    it(`default ${scope.pageKey}/${scope.tabKey}: ${role}`, () => {
      const module = scope.pageKey.split("-")[0] as "leaf" | "soil" | "seed" | "fruit" | "forest";
      const minimum = scope.pageKey === "leaf-kanden" ? "manager" : MODULE_MIN_ROLES[module];
      expect(resolveCanView([], scope.pageKey, scope.tabKey, { employeeId: "employee", role })).toBe(isRoleAtLeast(role, minimum));
    });
  }
  for (const scope of LEAF_FOREST_VIEW_SCOPES) {
    it(`expand, narrow and individual grant ${scope.pageKey}/${scope.tabKey}`, () => {
      const viewer: Viewer = { employeeId: "employee", role: "toss" };
      expect(resolveCanView([setting(scope.pageKey, ["toss"], scope.tabKey)], scope.pageKey, scope.tabKey, viewer)).toBe(true);
      expect(resolveCanView([setting(scope.pageKey, [], scope.tabKey)], scope.pageKey, scope.tabKey, { ...viewer, role: "admin" })).toBe(false);
      expect(resolveCanView([setting(scope.pageKey, [], scope.tabKey, ["employee"])], scope.pageKey, scope.tabKey, viewer)).toBe(true);
      expect(resolveCanView([setting(scope.pageKey, [], scope.tabKey)], scope.pageKey, scope.tabKey, { ...viewer, role: "super_admin" })).toBe(true);
    });
  }
  it("tab overrides page, denied URL/data scope fails closed", async () => {
    mocks.permissions = [setting("forest-dashboard", ["staff"]), setting("forest-dashboard", [], "matrix")];
    expect(await canViewLeafForest("forest-dashboard", "overview")).toBe(true);
    expect(await canViewLeafForest("forest-dashboard", "matrix")).toBe(false);
    await expect(requireLeafForestRead("forest-dashboard", "matrix")).rejects.toThrow();
    await expect(requireLeafForestRead("forest-unknown")).rejects.toThrow();
  });
  it("legacy Forest membership is retained; an explicit viewer grant does not create a writer", async () => {
    mocks.viewer.role = "manager";
    await expect(requireForestDataRead("forest-dashboard")).rejects.toThrow();
    mocks.permissions = [setting("forest-dashboard", ["manager"])];
    await expect(requireForestDataRead("forest-dashboard")).resolves.toBeTruthy();
    expect(mocks.member).toBe(false);
    await expect(requireForestDataRead("forest-dashboard", "invalid")).rejects.toThrow();
    const mutations = readFileSync("src/app/forest/_lib/mutations.ts", "utf8");
    expect(mutations).not.toContain("getSupabaseAdmin");
    const soil = readFileSync("src/app/api/soil/list/_lib/auth.ts", "utf8");
    expect(soil).toContain('if (readTab !== undefined)');
  });
  it("navigation maps static and dynamic routes without including the external portal", () => {
    for (const [key, href] of LEAF_FOREST_PAGES) expect(leafForestPageKey(href.replace(/\[[^\]]+\]/g, "example"))).toBe(key);
    expect(leafForestPageKey("/p/toss")).toBeUndefined();
    expect(leafForestPageKey("/forest/login")).toBeUndefined();
  });
  it("旧プロトタイプの設定は案件一覧の閲覧権限にならない", () => {
    const settings = [
      setting("leaf-kanden-input", ["staff"], "input"),
      setting("leaf-kanden-backoffice", ["staff"]),
    ];
    expect(resolveCanView(settings, "leaf-kanden", "", mocks.viewer)).toBe(false);
    expect(resolveCanView(settings, "leaf-kanden-backoffice", "", mocks.viewer)).toBe(false);
    expect(leafForestPageKey("/leaf/kanden/input")).toBeUndefined();
  });
  it("migration matches every scope and forbids viewer delegation on private/financial screens", () => {
    const sql = readFileSync("supabase/migrations/20261027000446_leaf_soil_seed_fruit_forest_view_permissions.sql", "utf8");
    for (const scope of LEAF_FOREST_VIEW_SCOPES.filter(scope => scope.pageKey !== "leaf-kanden")) {
      expect(sql).toContain(`('${scope.pageKey}','${scope.tabKey}','${scope.label}',`);
    }
    const kanden = readFileSync("supabase/migrations/20261120000537_leaf_kanden_orders.sql", "utf8");
    expect(kanden).toContain("('leaf-kanden', '', '関電 案件一覧', array['manager', 'admin', 'super_admin']");
    expect(sql).toContain("page_key not like 'leaf-%' and page_key not like 'forest-%'");
    expect(sql).not.toMatch(/for (insert|update|delete)/i);
    expect(sql).not.toContain("/p/toss");
    expect(sql).not.toContain("?".repeat(3)); expect(sql.charCodeAt(0)).not.toBe(0xfeff);
  });
});
