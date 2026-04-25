/**
 * Garden Root — GardenRole 階層マトリックステスト（Task T5）
 *
 * 対象:
 *   - isRoleAtLeast の全 8×8 = 64 セル網羅
 *   - 反射律 / 反対称律 / 推移律
 *   - アクセス配列の意味的整合性
 *   - outsource 境界の追加エッジケース
 *   - GARDEN_ROLE_LABELS 網羅 + ユニーク性
 *   - GARDEN_ROLE_ORDER の固定（順序ピニングテスト）
 *
 * NOTE: 既存の garden-role.test.ts と重複するテストは含めない。
 *       （outsource insertion 確認, LABELS 外注ラベル, super_admin ループ, etc.）
 */

import { describe, it, expect } from "vitest";
import {
  GARDEN_ROLE_ORDER,
  GARDEN_ROLE_LABELS,
  ROOT_VIEW_ROLES,
  ROOT_WRITE_ROLES,
  TREE_CONFIRM_VIEW_ROLES,
  isRoleAtLeast,
  type GardenRole,
} from "@/app/root/_constants/types";

// ============================================================
// 期待階層マトリックス（テスト内の真実源）
// 縦: target、横: baseline
// true  = target は baseline 以上の権限を持つ
// false = target は baseline 未満の権限しか持たない
// ============================================================
//
// 階層（昇順）:
//   0: toss
//   1: closer
//   2: cs
//   3: staff
//   4: outsource
//   5: manager
//   6: admin
//   7: super_admin
//
const EXPECTED_HIERARCHY: Record<GardenRole, Record<GardenRole, boolean>> = {
  //                toss    closer  cs      staff   outsource manager admin   super_admin
  toss:        { toss: true,  closer: false, cs: false, staff: false, outsource: false, manager: false, admin: false, super_admin: false },
  closer:      { toss: true,  closer: true,  cs: false, staff: false, outsource: false, manager: false, admin: false, super_admin: false },
  cs:          { toss: true,  closer: true,  cs: true,  staff: false, outsource: false, manager: false, admin: false, super_admin: false },
  staff:       { toss: true,  closer: true,  cs: true,  staff: true,  outsource: false, manager: false, admin: false, super_admin: false },
  outsource:   { toss: true,  closer: true,  cs: true,  staff: true,  outsource: true,  manager: false, admin: false, super_admin: false },
  manager:     { toss: true,  closer: true,  cs: true,  staff: true,  outsource: true,  manager: true,  admin: false, super_admin: false },
  admin:       { toss: true,  closer: true,  cs: true,  staff: true,  outsource: true,  manager: true,  admin: true,  super_admin: false },
  super_admin: { toss: true,  closer: true,  cs: true,  staff: true,  outsource: true,  manager: true,  admin: true,  super_admin: true  },
};

// ============================================================
// 1. 全 8×8 マトリックス（64 セル）
// ============================================================
describe("isRoleAtLeast — full 8x8 hierarchy matrix", () => {
  describe.each(GARDEN_ROLE_ORDER)("target=%s", (target) => {
    it.each(GARDEN_ROLE_ORDER)("vs baseline=%s", (baseline) => {
      const expected = EXPECTED_HIERARCHY[target][baseline];
      expect(isRoleAtLeast(target, baseline)).toBe(expected);
    });
  });
});

// ============================================================
// 2. 反射律: isRoleAtLeast(R, R) === true
// ============================================================
describe("isRoleAtLeast — reflexivity", () => {
  it.each(GARDEN_ROLE_ORDER)("%s is at least itself", (role) => {
    expect(isRoleAtLeast(role, role)).toBe(true);
  });
});

// ============================================================
// 3. 反対称律: A ≠ B かつ isRoleAtLeast(A,B) なら isRoleAtLeast(B,A) === false
// ============================================================
describe("isRoleAtLeast — antisymmetry", () => {
  for (const a of GARDEN_ROLE_ORDER) {
    for (const b of GARDEN_ROLE_ORDER) {
      if (a === b) continue;
      it(`if ${a} >= ${b} then NOT (${b} >= ${a})`, () => {
        if (isRoleAtLeast(a, b)) {
          expect(isRoleAtLeast(b, a)).toBe(false);
        }
        // 逆向きのケース: isRoleAtLeast(a, b) が false のとき制約なし（スキップ）
      });
    }
  }
});

// ============================================================
// 4. 推移律: A>=B かつ B>=C なら A>=C（8^3 = 512 トリプル）
// ============================================================
describe("isRoleAtLeast — transitivity", () => {
  for (const a of GARDEN_ROLE_ORDER) {
    for (const b of GARDEN_ROLE_ORDER) {
      for (const c of GARDEN_ROLE_ORDER) {
        if (isRoleAtLeast(a, b) && isRoleAtLeast(b, c)) {
          it(`${a} >= ${b} >= ${c}  =>  ${a} >= ${c}`, () => {
            expect(isRoleAtLeast(a, c)).toBe(true);
          });
        }
      }
    }
  }
});

// ============================================================
// 5. アクセス配列の意味的整合性
// ============================================================
describe("Access-array semantic consistency", () => {
  it("ROOT_VIEW_ROLES matches exactly roles where isRoleAtLeast(R, 'manager')", () => {
    const fromHierarchy = GARDEN_ROLE_ORDER.filter((r) => isRoleAtLeast(r, "manager"));
    expect([...ROOT_VIEW_ROLES].sort()).toEqual([...fromHierarchy].sort());
  });

  it("ROOT_WRITE_ROLES matches exactly roles where isRoleAtLeast(R, 'admin')", () => {
    const fromHierarchy = GARDEN_ROLE_ORDER.filter((r) => isRoleAtLeast(r, "admin"));
    expect([...ROOT_WRITE_ROLES].sort()).toEqual([...fromHierarchy].sort());
  });

  it("TREE_CONFIRM_VIEW_ROLES matches exactly (isRoleAtLeast(R, 'cs') && R !== 'outsource')", () => {
    const fromHierarchy = GARDEN_ROLE_ORDER.filter(
      (r) => isRoleAtLeast(r, "cs") && r !== "outsource"
    );
    expect([...TREE_CONFIRM_VIEW_ROLES].sort()).toEqual([...fromHierarchy].sort());
  });

  it("TREE_CONFIRM_VIEW_ROLES explicitly excludes outsource despite outsource >= cs", () => {
    // outsource is cs or higher in the hierarchy ...
    expect(isRoleAtLeast("outsource", "cs")).toBe(true);
    // ... but is intentionally excluded from TREE_CONFIRM_VIEW_ROLES
    expect(TREE_CONFIRM_VIEW_ROLES).not.toContain("outsource");
  });
});

// ============================================================
// 6. outsource 境界の追加エッジケース（既存テストにない組み合わせ）
// ============================================================
describe("outsource boundary — additional edge cases", () => {
  it("outsource >= cs  (outsource is above cs)", () => {
    expect(isRoleAtLeast("outsource", "cs")).toBe(true);
  });

  it("outsource >= closer", () => {
    expect(isRoleAtLeast("outsource", "closer")).toBe(true);
  });

  it("outsource >= toss", () => {
    expect(isRoleAtLeast("outsource", "toss")).toBe(true);
  });

  it("cs is NOT >= outsource", () => {
    expect(isRoleAtLeast("cs", "outsource")).toBe(false);
  });

  it("closer is NOT >= outsource", () => {
    expect(isRoleAtLeast("closer", "outsource")).toBe(false);
  });

  it("toss is NOT >= outsource", () => {
    expect(isRoleAtLeast("toss", "outsource")).toBe(false);
  });

  it("admin >= outsource", () => {
    expect(isRoleAtLeast("admin", "outsource")).toBe(true);
  });

  it("super_admin >= outsource", () => {
    expect(isRoleAtLeast("super_admin", "outsource")).toBe(true);
  });
});

// ============================================================
// 7. GARDEN_ROLE_LABELS 網羅 + ユニーク性
// ============================================================
describe("GARDEN_ROLE_LABELS coverage and uniqueness", () => {
  it("every role has a non-empty string label", () => {
    for (const role of GARDEN_ROLE_ORDER) {
      expect(typeof GARDEN_ROLE_LABELS[role]).toBe("string");
      expect(GARDEN_ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("all labels are unique (no two roles share the same label)", () => {
    const labels = GARDEN_ROLE_ORDER.map((r) => GARDEN_ROLE_LABELS[r]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

// ============================================================
// 8. GARDEN_ROLE_ORDER 固定（順序ピニングテスト）
// ============================================================
describe("GARDEN_ROLE_ORDER stability", () => {
  it("must equal the canonical 8-role order exactly", () => {
    expect(GARDEN_ROLE_ORDER).toEqual([
      "toss",
      "closer",
      "cs",
      "staff",
      "outsource",
      "manager",
      "admin",
      "super_admin",
    ]);
  });
});
