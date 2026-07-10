import { describe, expect, it } from "vitest";

import {
  clampReceiptInlineZoom,
  containedReceiptBaseSize,
  isReceiptInlineZoomed,
  receiptScrollFrameSize,
  scaledReceiptDisplaySize,
  shouldUpdateReceiptMeasure,
  zoomReceiptInlineIn,
  zoomReceiptInlineOut,
} from "../receipt-zoom";

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

  it("updates the measured receipt box only at actual size", () => {
    expect(shouldUpdateReceiptMeasure(1)).toBe(true);
    expect(shouldUpdateReceiptMeasure(1.2)).toBe(false);
    expect(shouldUpdateReceiptMeasure(2.4)).toBe(false);
    expect(shouldUpdateReceiptMeasure(Number.NaN)).toBe(true);
  });

  it("keeps the contained base size independent from zoom", () => {
    const box = { w: 554, h: 600 };
    const natural = { w: 384, h: 473 };
    const base = containedReceiptBaseSize(0, box, natural);
    expect(base).toEqual(containedReceiptBaseSize(0, box, natural));
    expect(scaledReceiptDisplaySize(base!, 1)).toEqual(base);
    expect(scaledReceiptDisplaySize(base!, 1.2)).toEqual({
      width: Math.round(base!.width * 1.2),
      height: Math.round(base!.height * 1.2),
    });
    expect(scaledReceiptDisplaySize(base!, 1.4)).toEqual({
      width: Math.round(base!.width * 1.4),
      height: Math.round(base!.height * 1.4),
    });
  });

  it("does not exceed the expected 1.6x width after three clicks", () => {
    const base = containedReceiptBaseSize(0, { w: 554, h: 600 }, { w: 384, h: 473 });
    const zoom = zoomReceiptInlineIn(zoomReceiptInlineIn(zoomReceiptInlineIn(1)));
    expect(zoom).toBe(1.6);
    expect(scaledReceiptDisplaySize(base!, zoom).width).toBe(Math.round(base!.width * 1.6));
  });
});
