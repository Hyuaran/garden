import { describe, it, expect } from "vitest";
import {
  canTransitionWithRole,
  TRANSFER_STATUSES,
} from "../../_constants/transfer-status";
import type { TransferStatus } from "../../_constants/types";

type Role = "staff" | "approver" | "admin" | "super_admin";

describe("canTransitionWithRole — 通常遷移（全ロール同一）", () => {
  const baseline: Array<[TransferStatus, TransferStatus]> = [
    ["下書き", "確認済み"],
    ["下書き", "差戻し"],
    ["確認済み", "承認待ち"],
    ["確認済み", "下書き"],
    ["承認待ち", "承認済み"],
    ["承認待ち", "差戻し"],
    ["承認済み", "CSV出力済み"],
    ["CSV出力済み", "振込完了"],
    ["差戻し", "下書き"],
  ];

  for (const [from, to] of baseline) {
    it(`${from} → ${to} はすべてのロールで許可`, () => {
      const roles: Role[] = ["staff", "approver", "admin", "super_admin"];
      for (const role of roles) {
        expect(canTransitionWithRole(from, to, role)).toBe(true);
      }
    });
  }
});

describe("canTransitionWithRole — super_admin 自起票スキップ", () => {
  it("super_admin は 下書き → 承認済み へ直接遷移可", () => {
    expect(canTransitionWithRole("下書き", "承認済み", "super_admin")).toBe(true);
  });

  it("staff は 下書き → 承認済み へ直接遷移不可", () => {
    expect(canTransitionWithRole("下書き", "承認済み", "staff")).toBe(false);
  });

  it("approver は 下書き → 承認済み へ直接遷移不可", () => {
    expect(canTransitionWithRole("下書き", "承認済み", "approver")).toBe(false);
  });

  it("admin は 下書き → 承認済み へ直接遷移不可（super_admin だけがスキップ可）", () => {
    expect(canTransitionWithRole("下書き", "承認済み", "admin")).toBe(false);
  });
});

describe("canTransitionWithRole — 振込完了は終端", () => {
  it("振込完了からはどのロールでも遷移不可", () => {
    const roles: Role[] = ["staff", "approver", "admin", "super_admin"];
    for (const role of roles) {
      for (const to of TRANSFER_STATUSES) {
        expect(canTransitionWithRole("振込完了", to, role)).toBe(false);
      }
    }
  });
});

describe("canTransitionWithRole — 逆方向・スキップ遷移は不許可", () => {
  it("承認済み → 下書き は super_admin でも不許可", () => {
    expect(canTransitionWithRole("承認済み", "下書き", "super_admin")).toBe(false);
  });

  it("CSV出力済み → 承認済み は不許可", () => {
    expect(canTransitionWithRole("CSV出力済み", "承認済み", "super_admin")).toBe(false);
  });

  it("下書き → CSV出力済み は super_admin でも不許可（スキップは承認済み止まり）", () => {
    expect(canTransitionWithRole("下書き", "CSV出力済み", "super_admin")).toBe(false);
  });

  it("下書き → 振込完了 は super_admin でも不許可", () => {
    expect(canTransitionWithRole("下書き", "振込完了", "super_admin")).toBe(false);
  });
});
