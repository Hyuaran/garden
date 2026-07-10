import { describe, expect, it } from "vitest";

import { clampReceiptInlineZoom, isReceiptInlineZoomed, receiptScrollFrameSize, scaledReceiptDisplaySize, zoomReceiptInlineIn, zoomReceiptInlineOut } from "../receipt-zoom";

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

  it("calculates scaled image size for layout-based zoom", () => {
    expect(scaledReceiptDisplaySize({ width: 320, height: 240 }, 1.4)).toEqual({ width: 448, height: 336 });
  });

  it("uses the rotated visual bounds for the scroll frame", () => {
    expect(receiptScrollFrameSize({ width: 320, height: 240 }, 90, 1.5)).toEqual({ width: 360, height: 480 });
  });

  it("detects when inline zoom should leave centered layout", () => {
    expect(isReceiptInlineZoomed(1)).toBe(false);
    expect(isReceiptInlineZoomed(1.2)).toBe(true);
  });
});
