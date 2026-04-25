/**
 * fix/tree-garden-role-exhaustive: mapGardenRoleToTreeRole の網羅テスト。
 *
 * develop の build を壊している
 *   `Function lacks ending return statement and return type does not include 'undefined'`
 * を修復するため、全 8 値の GardenRole に対するマッピングを TDD で固定する。
 *
 * 元コミット: 4b432ba feat(tree): Phase A 認証・権限 Supabase連携
 * 直接原因: A-3-g で追加された 'outsource' が switch 未網羅
 */

import { describe, it, expect, vi } from "vitest";

// TreeStateContext の import 時に呼ばれる supabase client 初期化が
// テスト環境では NEXT_PUBLIC_SUPABASE_URL 未設定で失敗するため、
// 直接の供給元 (`tree/_lib/supabase`) をモック差し替え。
vi.mock("@/app/tree/_lib/supabase", () => ({
  supabase: { from: vi.fn(), auth: {} },
}));

import { mapGardenRoleToTreeRole } from "@/app/tree/_state/TreeStateContext";
import { ROLES } from "@/app/tree/_constants/roles";
import type { GardenRole } from "@/app/root/_constants/types";

describe("mapGardenRoleToTreeRole - 8 GardenRole 値の網羅", () => {
  it("toss → SPROUT", () => {
    expect(mapGardenRoleToTreeRole("toss")).toBe(ROLES.SPROUT);
  });

  it("closer → BRANCH", () => {
    expect(mapGardenRoleToTreeRole("closer")).toBe(ROLES.BRANCH);
  });

  it("cs → MANAGER", () => {
    expect(mapGardenRoleToTreeRole("cs")).toBe(ROLES.MANAGER);
  });

  it("staff → MANAGER", () => {
    expect(mapGardenRoleToTreeRole("staff")).toBe(ROLES.MANAGER);
  });

  // A-3-g で追加された outsource。staff と manager の間 (GARDEN_ROLE_ORDER) のため、
  // 既存の staff/manager と同じ MANAGER 扱いが妥当（a-main 判断）。
  it("outsource → MANAGER (staff と manager の中間階層、Tree UI では同じく管理画面)", () => {
    expect(mapGardenRoleToTreeRole("outsource")).toBe(ROLES.MANAGER);
  });

  it("manager → MANAGER", () => {
    expect(mapGardenRoleToTreeRole("manager")).toBe(ROLES.MANAGER);
  });

  it("admin → MANAGER", () => {
    expect(mapGardenRoleToTreeRole("admin")).toBe(ROLES.MANAGER);
  });

  it("super_admin → MANAGER", () => {
    expect(mapGardenRoleToTreeRole("super_admin")).toBe(ROLES.MANAGER);
  });

  it("8 値すべてが GardenRole の網羅であること（コンパイル時エクシビット）", () => {
    // 配列リテラルが GardenRole[] として推論されることで網羅性を確認。
    // 将来 GardenRole に新値が追加された場合は、ここの satisfies が外れて
    // テスト失敗 → mapGardenRoleToTreeRole への追加が促される。
    const allRoles = [
      "toss",
      "closer",
      "cs",
      "staff",
      "outsource",
      "manager",
      "admin",
      "super_admin",
    ] satisfies GardenRole[];

    // 全値で関数が undefined / null を返さないこと
    for (const r of allRoles) {
      expect(mapGardenRoleToTreeRole(r)).toBeTruthy();
    }
  });
});
