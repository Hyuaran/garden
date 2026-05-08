import { describe, it, expect } from "vitest";
import {
  canTransition,
  TRANSFER_STATUSES,
  TRANSFER_STATUS_TRANSITIONS,
} from "../../_constants/transfer-status";

describe("TRANSFER_STATUSES", () => {
  it("7 つのステータス（6 段階 + 差戻し）", () => {
    expect(TRANSFER_STATUSES).toHaveLength(7);
  });

  it("全ステータスに遷移ルールが定義されている", () => {
    for (const status of TRANSFER_STATUSES) {
      expect(TRANSFER_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });
});

describe("canTransition", () => {
  it("下書き → 確認済みは許可", () => {
    expect(canTransition("下書き", "確認済み")).toBe(true);
  });

  it("下書き → 承認済み（直接）は不許可（super_admin スキップ専用）", () => {
    expect(canTransition("下書き", "承認済み")).toBe(false);
  });

  it("確認済み → 承認待ちは許可", () => {
    expect(canTransition("確認済み", "承認待ち")).toBe(true);
  });

  it("確認済み → 下書き（戻し）は許可", () => {
    expect(canTransition("確認済み", "下書き")).toBe(true);
  });

  it("承認待ち → 承認済みは許可", () => {
    expect(canTransition("承認待ち", "承認済み")).toBe(true);
  });

  it("承認待ち → 差戻しは許可", () => {
    expect(canTransition("承認待ち", "差戻し")).toBe(true);
  });

  it("承認済み → CSV出力済みは許可", () => {
    expect(canTransition("承認済み", "CSV出力済み")).toBe(true);
  });

  it("CSV出力済み → 振込完了は許可", () => {
    expect(canTransition("CSV出力済み", "振込完了")).toBe(true);
  });

  it("振込完了からはどこにも遷移不可（終端）", () => {
    for (const to of TRANSFER_STATUSES) {
      expect(canTransition("振込完了", to)).toBe(false);
    }
  });

  it("差戻し → 下書きは許可", () => {
    expect(canTransition("差戻し", "下書き")).toBe(true);
  });

  it("逆方向遷移（承認済み → 下書きなど）は不許可", () => {
    expect(canTransition("承認済み", "下書き")).toBe(false);
    expect(canTransition("CSV出力済み", "承認済み")).toBe(false);
  });
});
