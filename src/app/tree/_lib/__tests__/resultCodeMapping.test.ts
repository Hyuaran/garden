/**
 * resultCodeMapping.ts — ユニットテスト
 *
 * テストケース（最低 5 件）:
 *   1. 既知ラベル「トス」→ result_code 'toss' に変換される
 *   2. 未知ラベルは null を返す
 *   3. isMemoRequired: toss = true
 *   4. isMemoRequired: toss 以外 = false
 *   5. resultCodeToGroup: toss → positive
 *   6. resultCodeToGroup: sight_A → pending
 *   7. resultCodeToGroup: ng_refuse → negative
 *   8. resultCodeToGroup: unreach → neutral
 *   9. 全 SPROUT_BUTTONS ラベルが変換可能であること
 */

import { describe, it, expect } from "vitest";
import {
  labelToResultCode,
  resultCodeToGroup,
  isMemoRequired,
  type ResultCode,
} from "../resultCodeMapping";

describe("labelToResultCode", () => {
  it("「トス」→ 'toss' に変換される", () => {
    expect(labelToResultCode("トス")).toBe("toss");
  });

  it("「NG クレーム」→ 'ng_claim' に変換される", () => {
    expect(labelToResultCode("NG クレーム")).toBe("ng_claim");
  });

  it("「見込 A」→ 'sight_A' に変換される", () => {
    expect(labelToResultCode("見込 A")).toBe("sight_A");
  });

  it("未知ラベルは null を返す", () => {
    expect(labelToResultCode("存在しないラベル")).toBeNull();
    expect(labelToResultCode("")).toBeNull();
  });

  it("全 SPROUT_BUTTONS ラベル（10 種）が変換可能", () => {
    const sproutLabels = [
      "トス", "担不", "見込 A", "見込 B", "見込 C",
      "不通", "NG お断り", "NG クレーム", "NG 契約済", "NG その他",
    ];
    sproutLabels.forEach((label) => {
      expect(labelToResultCode(label)).not.toBeNull();
    });
  });
});

describe("resultCodeToGroup", () => {
  it("toss → positive", () => {
    expect(resultCodeToGroup("toss")).toBe("positive");
  });

  it("sight_A → pending", () => {
    expect(resultCodeToGroup("sight_A")).toBe("pending");
  });

  it("ng_refuse → negative", () => {
    expect(resultCodeToGroup("ng_refuse")).toBe("negative");
  });

  it("unreach → neutral", () => {
    expect(resultCodeToGroup("unreach")).toBe("neutral");
  });

  it("tantou_fuzai → neutral", () => {
    expect(resultCodeToGroup("tantou_fuzai")).toBe("neutral");
  });
});

describe("isMemoRequired", () => {
  it("toss の場合は true", () => {
    expect(isMemoRequired("toss")).toBe(true);
  });

  it("toss 以外（order）は false", () => {
    expect(isMemoRequired("order")).toBe(false);
  });

  it("toss 以外（unreach）は false", () => {
    expect(isMemoRequired("unreach")).toBe(false);
  });

  it("toss 以外（ng_claim）は false", () => {
    expect(isMemoRequired("ng_claim")).toBe(false);
  });

  it("toss 以外（sight_B）は false", () => {
    expect(isMemoRequired("sight_B" as ResultCode)).toBe(false);
  });
});
