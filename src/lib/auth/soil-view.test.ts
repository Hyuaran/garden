import { expect, it } from "vitest";
import { resolveCanView, type ViewPermission } from "./view-permission";
import { SOIL_VIEW_SCOPES, soilPageKey } from "./soil-view-scopes";
import { LEAF_FOREST_VIEW_SCOPES } from "./leaf-forest-view-scopes";

const viewer = { role: "staff" as const, employeeId: "EMP-1" };
const setting = (page_key: string, employee_ids: string[] = []): ViewPermission => ({
  page_key, tab_key: "", roles: [], employee_ids, viewers_can_add: false,
  updated_by: "ADMIN", updated_at: "2026-11-12T00:00:00Z",
});

it("ホームは既存のscopeと保存済み設定を保つ", () => {
  expect(SOIL_VIEW_SCOPES[0]).toBe(LEAF_FOREST_VIEW_SCOPES.find(scope => scope.pageKey === "soil-overview"));
  expect(resolveCanView([setting("soil-overview", ["EMP-1"])], "soil-overview", "", viewer)).toBe(true);
  expect(soilPageKey("/soil")).toBe("soil-overview");
  expect(soilPageKey("/soil/product-points?x=1")).toBe("soil-product-points");
});
it("旧個人設定を引き継ぎ、新設定の拒否を優先する", () => {
  const old = setting("system-product-points", ["EMP-1"]);
  expect(resolveCanView([old], "soil-product-points", "", viewer)).toBe(true);
  expect(resolveCanView([old, setting("soil-product-points")], "soil-product-points", "", viewer)).toBe(false);
  expect(resolveCanView([], "soil-product-points", "", viewer)).toBe(false);
  expect(resolveCanView([], "soil-product-points", "", { ...viewer, role: "manager" })).toBe(true);
});
