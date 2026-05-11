/**
 * Garden Root — super_admin 権限固定（Task 5）の単体テスト
 *
 * 対象:
 *   - GARDEN_ROLE_SELECTABLE_OPTIONS が super_admin を含まないこと
 *   - GARDEN_ROLE_SELECTABLE_OPTIONS が super_admin 以外の 7 ロール全部を含むこと
 *   - isSuperAdminLockEnabled() が true を返すこと
 *
 * 仕様:
 *   - memory project_super_admin_operation.md
 *   - docs/specs/plans/2026-05-11-garden-unified-auth-plan.md Task 5
 */

import { describe, it, expect } from "vitest";
import {
  GARDEN_ROLE_SELECTABLE_OPTIONS,
  isSuperAdminLockEnabled,
  GARDEN_ROLE_ORDER,
} from "../types";

describe("super_admin lockdown", () => {
  it("SELECTABLE_OPTIONS に super_admin が含まれない", () => {
    expect(GARDEN_ROLE_SELECTABLE_OPTIONS.map((o) => o.value)).not.toContain("super_admin");
  });

  it("SELECTABLE_OPTIONS は super_admin 以外の 7 ロール全部を含む", () => {
    const values = GARDEN_ROLE_SELECTABLE_OPTIONS.map((o) => o.value);
    const expected = GARDEN_ROLE_ORDER.filter((r) => r !== "super_admin");
    expect(values.sort()).toEqual(expected.sort());
  });

  it("isSuperAdminLockEnabled は true", () => {
    expect(isSuperAdminLockEnabled()).toBe(true);
  });
});
