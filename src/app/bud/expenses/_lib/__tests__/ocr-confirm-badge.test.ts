import { describe, expect, it } from "vitest";

import { getOcrConfirmBadgeTone, missingOcrConfirmRequiredFields, type OcrConfirmRequiredInput } from "../ocr-confirm-badge";

const filled: OcrConfirmRequiredInput = {
  receiptDate: "2026-07-10",
  receiptTime: "09:30",
  storeName: "Garden Store",
  amount: "1200",
  corpId: "hyuaran",
  categoryId: "parking",
  qualifiedClass: "有",
};

describe("getOcrConfirmBadgeTone", () => {
  it("hides the badge when all current values are filled", () => {
    expect(getOcrConfirmBadgeTone(filled)).toBe("hidden");
  });

  it("uses warning when only receipt time is missing", () => {
    expect(getOcrConfirmBadgeTone({ ...filled, receiptTime: "" })).toBe("warning");
  });

  it("uses danger when receipt time and another required field are missing", () => {
    expect(getOcrConfirmBadgeTone({ ...filled, receiptTime: "", storeName: "" })).toBe("danger");
  });

  it("uses danger when a required field other than receipt time is missing", () => {
    expect(getOcrConfirmBadgeTone({ ...filled, storeName: "" })).toBe("danger");
  });

  it("uses danger when amount is zero", () => {
    expect(getOcrConfirmBadgeTone({ ...filled, amount: 0 })).toBe("danger");
    expect(getOcrConfirmBadgeTone({ ...filled, amount: "0" })).toBe("danger");
  });

  it("depends only on the current values, not on a description marker", () => {
    const withoutAnyMarker = { ...filled, storeName: "" };
    expect(getOcrConfirmBadgeTone(withoutAnyMarker)).toBe("danger");
  });

  it("matches the review form required-field set", () => {
    expect(
      missingOcrConfirmRequiredFields({
        receiptDate: "",
        receiptTime: "",
        storeName: "",
        amount: "",
        corpId: "",
        categoryId: "",
        qualifiedClass: "",
      }),
    ).toEqual(["receiptDate", "storeName", "amount", "corpId", "categoryId", "qualifiedClass"]);
  });
});
