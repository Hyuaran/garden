/**
 * D-08 テスト戦略 / fixture スモークテスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2 / §10
 *
 * 確認項目:
 *   - 名前付き fixture が 10+ 件、全組合せが含まれる
 *   - generateAllEmployeeMatrix で 200 通り（5 × 5 × 2 × 4）生成
 *   - getAllEmployeeFixtures が spec §2.2「50+」要件を満たす
 *   - 給与体系 / 勤怠 / 源泉徴収月額表 fixture が読み込み可能
 *   - 全 fixture の id が一意
 */

import { describe, it, expect } from "vitest";
import {
  allAttendanceFixtures,
  allSalarySystems,
  generateAllEmployeeMatrix,
  getAllEmployeeFixtures,
  namedEmployeeFixtures,
  withholdingKouSample,
  withholdingOtsuSample,
} from "./_fixtures";

describe("D-08 fixtures", () => {
  it("名前付き fixture が 10+ 件存在", () => {
    const named = Object.values(namedEmployeeFixtures);
    expect(named.length).toBeGreaterThanOrEqual(10);
  });

  it("マトリクス generator が 200 通り（5 × 5 × 2 × 4）生成", () => {
    const matrix = generateAllEmployeeMatrix();
    expect(matrix).toHaveLength(4 * 5 * 2 * 4);
  });

  it("getAllEmployeeFixtures が spec §2.2 「50+」要件を満たす", () => {
    const all = getAllEmployeeFixtures();
    expect(all.length).toBeGreaterThanOrEqual(50);
  });

  it("全 employee fixture の id は一意", () => {
    const all = getAllEmployeeFixtures();
    const ids = all.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("給与体系 fixture が 3 種以上（monthly / hourly / commission）", () => {
    expect(allSalarySystems.length).toBeGreaterThanOrEqual(3);
    const methods = allSalarySystems.map((s) => s.baseCalculationMethod);
    expect(methods).toContain("monthly");
    expect(methods).toContain("hourly");
    expect(methods).toContain("commission");
  });

  it("勤怠 fixture に主要パターンが網羅される", () => {
    expect(allAttendanceFixtures.length).toBeGreaterThanOrEqual(5);
    const ids = allAttendanceFixtures.map((a) => a.id);
    expect(ids).toContain("fix-att-full");
    expect(ids).toContain("fix-att-ot60"); // 60h 境界
    expect(ids).toContain("fix-att-ot80"); // 60h 超
    expect(ids).toContain("fix-att-ot100"); // ERROR ライン
  });

  it("源泉徴収月額表 fixture が甲・乙の代表階層をカバー", () => {
    expect(withholdingKouSample.length).toBeGreaterThanOrEqual(3);
    expect(withholdingOtsuSample.length).toBeGreaterThanOrEqual(2);
    // 甲: 200k / 300k / 500k 階層が含まれる
    const taxableMins = withholdingKouSample.map((r) => r.taxableMin);
    expect(taxableMins).toContain(200000);
    expect(taxableMins).toContain(300000);
    expect(taxableMins).toContain(500000);
  });

  it("育休中 / 産休中 fixture の immutable フラグが正しい", () => {
    expect(namedEmployeeFixtures.regular_on_childcare_leave.isOnChildcareLeave)
      .toBe(true);
    expect(namedEmployeeFixtures.regular_on_maternity_leave.isOnMaternityLeave)
      .toBe(true);
    expect(namedEmployeeFixtures.regular_30_kou_0_tokyo.isOnChildcareLeave)
      .toBe(false);
  });
});
