/**
 * Garden Root — GardenRole 関連のロジックテスト（Phase A-3-g）
 *
 * 対象:
 *   - GARDEN_ROLE_ORDER に outsource が staff と manager の間にある
 *   - GARDEN_ROLE_LABELS に外注が追加されている
 *   - isRoleAtLeast が outsource 追加後も階層比較として正しい
 *   - ROOT_VIEW_ROLES / ROOT_WRITE_ROLES が outsource を含まないこと（= manager 以上のまま）
 */

import { describe, it, expect } from "vitest";
import {
  GARDEN_ROLE_ORDER,
  GARDEN_ROLE_LABELS,
  ROOT_VIEW_ROLES,
  ROOT_WRITE_ROLES,
  TREE_CONFIRM_VIEW_ROLES,
  isRoleAtLeast,
} from "@/app/root/_constants/types";

describe("GARDEN_ROLE_ORDER (Phase A-3-g outsource insertion)", () => {
  it("includes exactly 8 roles (7 + outsource)", () => {
    expect(GARDEN_ROLE_ORDER).toHaveLength(8);
  });

  it("places outsource between staff and manager", () => {
    const staffIdx = GARDEN_ROLE_ORDER.indexOf("staff");
    const outsourceIdx = GARDEN_ROLE_ORDER.indexOf("outsource");
    const managerIdx = GARDEN_ROLE_ORDER.indexOf("manager");
    expect(staffIdx).toBeGreaterThanOrEqual(0);
    expect(outsourceIdx).toBe(staffIdx + 1);
    expect(managerIdx).toBe(outsourceIdx + 1);
  });

  it("starts with toss and ends with super_admin", () => {
    expect(GARDEN_ROLE_ORDER[0]).toBe("toss");
    expect(GARDEN_ROLE_ORDER[GARDEN_ROLE_ORDER.length - 1]).toBe("super_admin");
  });
});

describe("GARDEN_ROLE_LABELS", () => {
  it("provides Japanese label for outsource", () => {
    expect(GARDEN_ROLE_LABELS.outsource).toBe("外注");
  });

  it("has labels for all 8 roles", () => {
    for (const role of GARDEN_ROLE_ORDER) {
      expect(GARDEN_ROLE_LABELS[role]).toBeTypeOf("string");
      expect(GARDEN_ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });
});

describe("isRoleAtLeast with outsource", () => {
  it("outsource is at least staff (outsource > staff in hierarchy)", () => {
    expect(isRoleAtLeast("outsource", "staff")).toBe(true);
  });

  it("outsource is NOT at least manager (outsource < manager)", () => {
    expect(isRoleAtLeast("outsource", "manager")).toBe(false);
  });

  it("manager is at least outsource", () => {
    expect(isRoleAtLeast("manager", "outsource")).toBe(true);
  });

  it("staff is NOT at least outsource", () => {
    expect(isRoleAtLeast("staff", "outsource")).toBe(false);
  });

  it("super_admin is at least any role", () => {
    for (const role of GARDEN_ROLE_ORDER) {
      expect(isRoleAtLeast("super_admin", role)).toBe(true);
    }
  });

  it("toss is only at least toss", () => {
    expect(isRoleAtLeast("toss", "toss")).toBe(true);
    expect(isRoleAtLeast("toss", "closer")).toBe(false);
  });
});

describe("ROOT access arrays unchanged by outsource addition", () => {
  it("ROOT_VIEW_ROLES still requires manager+ (outsource excluded)", () => {
    expect(ROOT_VIEW_ROLES).not.toContain("outsource");
    expect(ROOT_VIEW_ROLES).toContain("manager");
    expect(ROOT_VIEW_ROLES).toContain("admin");
    expect(ROOT_VIEW_ROLES).toContain("super_admin");
  });

  it("ROOT_WRITE_ROLES still requires admin+ (outsource excluded)", () => {
    expect(ROOT_WRITE_ROLES).not.toContain("outsource");
    expect(ROOT_WRITE_ROLES).toEqual(["admin", "super_admin"]);
  });

  it("TREE_CONFIRM_VIEW_ROLES does NOT include outsource by default", () => {
    // outsource は Tree 前確/後確画面の対象外（必要なら別タスクで判断）
    expect(TREE_CONFIRM_VIEW_ROLES).not.toContain("outsource");
  });
});
