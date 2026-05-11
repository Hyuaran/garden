/**
 * module-visibility 単体テスト
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 2 §Step 2-5
 *
 * 8 role × 12 module の確定マトリクス (plan §IN-3) を検証。
 */

import { describe, it, expect } from "vitest";

import {
  getVisibleModules,
  isHomeForbidden,
  DEFAULT_VISIBILITY_MATRIX,
  MODULE_KEYS,
} from "../module-visibility";

describe("module-visibility", () => {
  describe("getVisibleModules", () => {
    it.each([
      ["super_admin", 12],
      ["admin", 12],
      ["manager", 12],
      ["staff", 10],
      ["cs", 4],
      ["closer", 0],
      ["toss", 0],
      ["outsource", 0],
    ])("role=%s で %d module 可視", (role, count) => {
      expect(getVisibleModules(role)).toHaveLength(count);
    });

    it("staff は Soil / Rill 非可視", () => {
      const v = getVisibleModules("staff");
      expect(v).not.toContain("Soil");
      expect(v).not.toContain("Rill");
      expect(v).toContain("Bloom");
    });

    it("cs は Bloom/Tree/Leaf/Calendar の 4 module のみ", () => {
      expect(getVisibleModules("cs").slice().sort()).toEqual([
        "Bloom",
        "Calendar",
        "Leaf",
        "Tree",
      ]);
    });

    it("不明 role は staff にフォールバック", () => {
      expect(getVisibleModules("unknown_role")).toEqual(
        DEFAULT_VISIBILITY_MATRIX.staff,
      );
      expect(getVisibleModules(null)).toEqual(DEFAULT_VISIBILITY_MATRIX.staff);
    });
  });

  describe("isHomeForbidden", () => {
    it.each(["closer", "toss", "outsource"])("%s は禁止", (role) => {
      expect(isHomeForbidden(role)).toBe(true);
    });
    it.each(["super_admin", "admin", "manager", "staff", "cs"])(
      "%s は許可",
      (role) => {
        expect(isHomeForbidden(role)).toBe(false);
      },
    );
  });

  describe("MODULE_KEYS", () => {
    it("12 モジュール完備", () => {
      expect(MODULE_KEYS).toHaveLength(12);
    });
  });
});
