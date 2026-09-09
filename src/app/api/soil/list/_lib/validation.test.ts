import { describe, expect, it } from "vitest";

import { canUseSoilList } from "./auth";
import {
  SoilListRequestError,
  normalizeConditionRequestPayload,
  normalizeConditionPayload,
  normalizeExportColumns,
  normalizeExportLimit,
} from "./validation";

describe("soil list validation", () => {
  it("accepts only defined fields and operators", () => {
    expect(
      normalizeConditionPayload({
        filters: [
          { field: "prefecture", op: "eq", value: "大阪府" },
          { field: "listName", op: "contains", value: "サンプル" },
          { field: "appointmentBlocked", op: "empty" },
          { field: "purchaseHistoryExists", op: "eq", value: false },
        ],
      }),
    ).toEqual({
      filters: [
        { field: "prefecture", op: "eq", value: "大阪府" },
        { field: "listName", op: "contains", value: "サンプル" },
        { field: "appointmentBlocked", op: "empty" },
        { field: "purchaseHistoryExists", op: "eq", value: false },
      ],
    });

    expect(() =>
      normalizeConditionPayload({
        filters: [{ field: "未定義列", op: "eq", value: "x" }],
      }),
    ).toThrow(SoilListRequestError);
    expect(() =>
      normalizeConditionPayload({
        filters: [{ field: "prefecture", op: "raw", value: "x" }],
      }),
    ).toThrow(SoilListRequestError);
  });

  it("converts old saved purchase history filters to the parent column", () => {
    expect(
      normalizeConditionPayload({
        filters: [{ field: "purchaseHistory", op: "eq", value: "あり" }],
      }),
    ).toEqual({
      filters: [{ field: "purchaseHistoryExists", op: "eq", value: true }],
    });
  });

  it("reads filters from the shared condition request shape", () => {
    expect(
      normalizeConditionRequestPayload({
        condition: { filters: [{ field: "callCount", op: "lte", value: 3 }] },
      }),
    ).toEqual({
      filters: [{ field: "callCount", op: "lte", value: 3 }],
    });
  });

  it("accepts inOrEmpty with string arrays", () => {
    expect(
      normalizeConditionPayload({
        filters: [{ field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建"] }],
      }),
    ).toEqual({
      filters: [{ field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建"] }],
    });
  });

  it("rejects empty and oversized multi-select arrays", () => {
    expect(() =>
      normalizeConditionPayload({
        filters: [{ field: "prefecture", op: "in", value: [] }],
      }),
    ).toThrow("条件の値が正しくありません");

    expect(() =>
      normalizeConditionPayload({
        filters: [{ field: "prefecture", op: "inOrEmpty", value: Array.from({ length: 101 }, (_, index) => `値${index}`) }],
      }),
    ).toThrow("選べるのは 100 件までです");
  });

  it("keeps export columns in the allow list and validates limit", () => {
    expect(normalizeExportColumns(["phoneNumber", "name", "unknown"])).toEqual(["phoneNumber", "name"]);
    expect(normalizeExportLimit(50000)).toBe(50000);
    expect(() => normalizeExportLimit(50001)).toThrow(SoilListRequestError);
  });

  it("allows manager and above", () => {
    expect(canUseSoilList("staff")).toBe(false);
    expect(canUseSoilList("manager")).toBe(true);
    expect(canUseSoilList("admin")).toBe(true);
    expect(canUseSoilList("super_admin")).toBe(true);
  });
});
