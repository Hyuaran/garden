import { describe, it, expect } from "vitest";
import {
  validateTransitionInput,
  mapPostgresErrorCode,
} from "../transition-validator";

describe("validateTransitionInput", () => {
  it("正常な遷移パラメータは ok", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "確認済み",
    });
    expect(r.ok).toBe(true);
  });

  it("transferId が空なら NOT_FOUND", () => {
    const r = validateTransitionInput({
      transferId: "",
      toStatus: "確認済み",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NOT_FOUND");
    }
  });

  it("transferId が空白のみなら NOT_FOUND", () => {
    const r = validateTransitionInput({
      transferId: "   ",
      toStatus: "確認済み",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NOT_FOUND");
    }
  });

  it("差戻しで reason 未指定は MISSING_REASON", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "差戻し",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MISSING_REASON");
    }
  });

  it("差戻しで reason が空白のみは MISSING_REASON", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "差戻し",
      reason: "   ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MISSING_REASON");
    }
  });

  it("差戻しで reason が null は MISSING_REASON", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "差戻し",
      reason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MISSING_REASON");
    }
  });

  it("差戻しで reason あり（1 文字以上）は ok", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "差戻し",
      reason: "金額誤り",
    });
    expect(r.ok).toBe(true);
  });

  it("確認済み遷移で reason 未指定も ok（差戻し以外は任意）", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "確認済み",
    });
    expect(r.ok).toBe(true);
  });

  it("承認済み遷移で reason 未指定も ok", () => {
    const r = validateTransitionInput({
      transferId: "abc-123",
      toStatus: "承認済み",
    });
    expect(r.ok).toBe(true);
  });
});

describe("mapPostgresErrorCode", () => {
  it("NO_DATA_FOUND → NOT_FOUND", () => {
    expect(mapPostgresErrorCode("NO_DATA_FOUND", "transfer not found")).toBe(
      "NOT_FOUND",
    );
  });

  it("INSUFFICIENT_PRIVILEGE → UNAUTHORIZED", () => {
    expect(
      mapPostgresErrorCode("INSUFFICIENT_PRIVILEGE", "user not registered"),
    ).toBe("UNAUTHORIZED");
  });

  it("CHECK_VIOLATION → INVALID_TRANSITION", () => {
    expect(
      mapPostgresErrorCode("CHECK_VIOLATION", "invalid transition"),
    ).toBe("INVALID_TRANSITION");
  });

  it("INVALID_PARAMETER_VALUE → MISSING_REASON", () => {
    expect(
      mapPostgresErrorCode("INVALID_PARAMETER_VALUE", "reason required"),
    ).toBe("MISSING_REASON");
  });

  it("メッセージからの推測: invalid transition → INVALID_TRANSITION", () => {
    expect(mapPostgresErrorCode(undefined, "invalid transition: foo")).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("メッセージからの推測: reason required → MISSING_REASON", () => {
    expect(mapPostgresErrorCode(undefined, "reason required for 差戻し")).toBe(
      "MISSING_REASON",
    );
  });

  it("メッセージからの推測: not registered → UNAUTHORIZED", () => {
    expect(mapPostgresErrorCode(undefined, "user not registered")).toBe(
      "UNAUTHORIZED",
    );
  });

  it("メッセージからの推測: not found → NOT_FOUND", () => {
    expect(mapPostgresErrorCode(undefined, "transfer not found")).toBe(
      "NOT_FOUND",
    );
  });

  it("不明なコード・メッセージ → DB_ERROR", () => {
    expect(mapPostgresErrorCode("OTHER", "something went wrong")).toBe(
      "DB_ERROR",
    );
  });

  it("コードもメッセージも undefined → DB_ERROR", () => {
    expect(mapPostgresErrorCode(undefined, undefined)).toBe("DB_ERROR");
  });
});
