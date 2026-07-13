import { describe, expect, it } from "vitest";

import {
  clampReceiptInlineZoom,
  containedReceiptBaseSize,
  receiptAxisAlignment,
  receiptCenteredScrollTarget,
  receiptImageClickRatio,
  isReceiptInlineZoomed,
  nextReceiptRotation,
  normalizeReceiptRotation,
  receiptScrollFrameSize,
  scaledReceiptDisplaySize,
  shouldUpdateReceiptMeasure,
  receiptViewportCenterRatio,
  zoomReceiptInlineIn,
  zoomReceiptInlineOut,
} from "../receipt-zoom";

describe("receipt inline zoom", () => {
  it("normalizes persisted receipt rotations to quarter turns", () => {
    expect(normalizeReceiptRotation(90)).toBe(90);
    expect(normalizeReceiptRotation(450)).toBe(90);
    expect(normalizeReceiptRotation(-90)).toBe(270);
    expect(normalizeReceiptRotation(45)).toBe(0);
    expect(normalizeReceiptRotation(null)).toBe(0);
  });

  it("advances receipt rotation through all quarter turns", () => {
    expect(nextReceiptRotation(0)).toBe(90);
    expect(nextReceiptRotation(90)).toBe(180);
    expect(nextReceiptRotation(180)).toBe(270);
    expect(nextReceiptRotation(270)).toBe(0);
  });

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

  it("centers each axis that fits inside the viewport", () => {
    expect(
      receiptAxisAlignment({
        frameSize: { width: 390, height: 500 },
        viewport: { width: 714, height: 600 },
      }),
    ).toEqual({ horizontal: "center", vertical: "center" });
  });

  it("starts only the horizontal axis when the frame is too wide", () => {
    expect(
      receiptAxisAlignment({
        frameSize: { width: 800, height: 500 },
        viewport: { width: 714, height: 600 },
      }),
    ).toEqual({ horizontal: "start", vertical: "center" });
  });

  it("starts only the vertical axis when the frame is too tall", () => {
    expect(
      receiptAxisAlignment({
        frameSize: { width: 390, height: 700 },
        viewport: { width: 714, height: 600 },
      }),
    ).toEqual({ horizontal: "center", vertical: "start" });
  });

  it("starts both axes when the frame exceeds the viewport", () => {
    expect(
      receiptAxisAlignment({
        frameSize: { width: 800, height: 700 },
        viewport: { width: 714, height: 600 },
      }),
    ).toEqual({ horizontal: "start", vertical: "start" });
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

  it("calculates centered scroll targets for a center click without clamping", () => {
    expect(
      receiptCenteredScrollTarget({
        rotation: 0,
        baseSize: { width: 100, height: 200 },
        zoom: 2,
        viewport: { width: 50, height: 60 },
        pointRatio: { x: 0.5, y: 0.5 },
      }),
    ).toMatchObject({
      scrollLeft: 75,
      scrollTop: 170,
      targetPoint: { x: 100, y: 200 },
    });
  });

  it("rotates the clicked point before calculating the centered scroll target", () => {
    expect(
      receiptCenteredScrollTarget({
        rotation: 90,
        baseSize: { width: 100, height: 200 },
        zoom: 2,
        viewport: { width: 50, height: 60 },
        pointRatio: { x: 0, y: 0 },
      }),
    ).toMatchObject({
      scrollLeft: 350,
      scrollTop: 0,
      targetPoint: { x: 400, y: 0 },
      scrollSize: { width: 400, height: 200 },
    });
  });

  it("handles a 270 degree rotated edge click with scroll clamping", () => {
    expect(
      receiptCenteredScrollTarget({
        rotation: 270,
        baseSize: { width: 100, height: 200 },
        zoom: 2,
        viewport: { width: 50, height: 60 },
        pointRatio: { x: 0, y: 0 },
      }),
    ).toMatchObject({
      scrollLeft: 0,
      scrollTop: 140,
      targetPoint: { x: 0, y: 200 },
      scrollSize: { width: 400, height: 200 },
    });
  });

  it("clamps edge clicks to the scrollable range", () => {
    expect(
      receiptCenteredScrollTarget({
        rotation: 0,
        baseSize: { width: 100, height: 100 },
        zoom: 2,
        viewport: { width: 80, height: 80 },
        pointRatio: { x: 1, y: 1 },
      }),
    ).toMatchObject({ scrollLeft: 120, scrollTop: 120 });
  });

  it("preserves the visible center ratio when zooming out", () => {
    const ratio = receiptViewportCenterRatio({
      rotation: 180,
      baseSize: { width: 100, height: 200 },
      zoom: 2,
      viewport: { width: 50, height: 60 },
      scroll: { left: 75, top: 170 },
    });
    const target = receiptCenteredScrollTarget({
      rotation: 180,
      baseSize: { width: 100, height: 200 },
      zoom: 1.6,
      viewport: { width: 50, height: 60 },
      pointRatio: ratio,
    });

    expect(ratio).toEqual({ x: 0.5, y: 0.5 });
    expect(target.scrollLeft).toBe(55);
    expect(target.scrollTop).toBe(130);
  });

  it("converts image click offsets to clamped point ratios", () => {
    expect(receiptImageClickRatio({ x: 25, y: 90 }, { width: 100, height: 200 })).toEqual({ x: 0.25, y: 0.45 });
    expect(receiptImageClickRatio({ x: 150, y: -20 }, { width: 100, height: 200 })).toEqual({ x: 1, y: 0 });
  });
});
