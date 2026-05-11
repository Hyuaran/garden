/**
 * module-min-roles 単体テスト (2026-05-11、Task 3)
 *
 * Garden 12 モジュールの最低必要ロール (MODULE_MIN_ROLES) と
 * isRoleAtLeast の組み合わせ判定を検証。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-2
 */

import { describe, it, expect } from "vitest";

import { MODULE_MIN_ROLES, type GardenModule } from "../module-min-roles";
import { isRoleAtLeast, type GardenRole } from "../../root/_constants/types";

describe("MODULE_MIN_ROLES", () => {
  it("12 モジュール全件が定義済", () => {
    const expected: GardenModule[] = [
      "soil",
      "root",
      "tree",
      "leaf",
      "bud",
      "bloom",
      "seed",
      "forest",
      "rill",
      "fruit",
      "sprout",
      "calendar",
    ];
    expect(Object.keys(MODULE_MIN_ROLES).sort()).toEqual(expected.sort());
  });

  it.each<[GardenModule, GardenRole]>([
    ["soil", "admin"],
    ["root", "manager"],
    ["tree", "toss"],
    ["leaf", "staff"],
    ["bud", "manager"],
    ["bloom", "staff"],
    ["seed", "staff"],
    ["forest", "manager"],
    ["rill", "admin"],
    ["fruit", "manager"],
    ["sprout", "staff"],
    ["calendar", "staff"],
  ])("%s の minRole は %s", (module, role) => {
    expect(MODULE_MIN_ROLES[module]).toBe(role);
  });
});

describe("ModuleGate role 判定 (isRoleAtLeast 経由)", () => {
  // staff が tree (toss min) に到達できることを確認 — 全 garden_role 通過
  it("staff は tree (minRole=toss) にアクセス可", () => {
    expect(isRoleAtLeast("staff", MODULE_MIN_ROLES.tree)).toBe(true);
  });

  it("staff は forest (minRole=manager) にアクセス不可", () => {
    expect(isRoleAtLeast("staff", MODULE_MIN_ROLES.forest)).toBe(false);
  });

  it("staff は soil (minRole=admin) にアクセス不可", () => {
    expect(isRoleAtLeast("staff", MODULE_MIN_ROLES.soil)).toBe(false);
  });

  it("manager は bud / forest / fruit / root にアクセス可", () => {
    expect(isRoleAtLeast("manager", MODULE_MIN_ROLES.bud)).toBe(true);
    expect(isRoleAtLeast("manager", MODULE_MIN_ROLES.forest)).toBe(true);
    expect(isRoleAtLeast("manager", MODULE_MIN_ROLES.fruit)).toBe(true);
    expect(isRoleAtLeast("manager", MODULE_MIN_ROLES.root)).toBe(true);
  });

  it("admin は soil / rill にアクセス可", () => {
    expect(isRoleAtLeast("admin", MODULE_MIN_ROLES.soil)).toBe(true);
    expect(isRoleAtLeast("admin", MODULE_MIN_ROLES.rill)).toBe(true);
  });

  it("toss は tree のみアクセス可、他は不可", () => {
    expect(isRoleAtLeast("toss", MODULE_MIN_ROLES.tree)).toBe(true);
    expect(isRoleAtLeast("toss", MODULE_MIN_ROLES.bloom)).toBe(false);
    expect(isRoleAtLeast("toss", MODULE_MIN_ROLES.forest)).toBe(false);
    expect(isRoleAtLeast("toss", MODULE_MIN_ROLES.bud)).toBe(false);
  });

  it("super_admin は全モジュールにアクセス可", () => {
    const modules: GardenModule[] = [
      "soil", "root", "tree", "leaf", "bud", "bloom",
      "seed", "forest", "rill", "fruit", "sprout", "calendar",
    ];
    modules.forEach((m) => {
      expect(isRoleAtLeast("super_admin", MODULE_MIN_ROLES[m])).toBe(true);
    });
  });

  it("outsource は staff レベル (leaf / bloom / seed / sprout / calendar) アクセス可", () => {
    // outsource は staff と manager の間
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.leaf)).toBe(true);
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.bloom)).toBe(true);
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.seed)).toBe(true);
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.sprout)).toBe(true);
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.calendar)).toBe(true);
    // forest (manager) は不可
    expect(isRoleAtLeast("outsource", MODULE_MIN_ROLES.forest)).toBe(false);
  });
});
