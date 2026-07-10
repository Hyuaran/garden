import { describe, expect, it } from "vitest";

import { clampReceiptInlineZoom, zoomReceiptInlineIn, zoomReceiptInlineOut } from "../receipt-zoom";

describe("receipt inline zoom", () => {
  it("zooms in by one step", () => {
    expect(zoomReceiptInlineIn(1)).toBe(1.2);
  });

  it("zooms out by one step", () => {
    expect(zoomReceiptInlineOut(1.4)).toBe(1.2);
  });

  it("does not zoom out below actual size", () => {
    expect(zoomReceiptInlineOut(1)).toBe(1);
  });

  it("does not zoom in above the maximum", () => {
    expect(zoomReceiptInlineIn(2.4)).toBe(2.4);
  });

  it("normalizes invalid values to actual size", () => {
    expect(clampReceiptInlineZoom(Number.NaN)).toBe(1);
  });
});
