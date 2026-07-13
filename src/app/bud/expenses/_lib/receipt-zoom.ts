export const RECEIPT_INLINE_ZOOM_MIN = 1;
export const RECEIPT_INLINE_ZOOM_MAX = 2.4;
export const RECEIPT_INLINE_ZOOM_STEP = 0.2;

export type ReceiptSize = { width: number; height: number };
export type ReceiptPoint = { x: number; y: number };
export type ReceiptPointRatio = { x: number; y: number };
export type ReceiptViewport = { width: number; height: number };
export type ReceiptScrollPosition = { left: number; top: number };

export function zoomReceiptInlineIn(value: number) {
  return clampReceiptInlineZoom(value + RECEIPT_INLINE_ZOOM_STEP);
}

export function zoomReceiptInlineOut(value: number) {
  return clampReceiptInlineZoom(value - RECEIPT_INLINE_ZOOM_STEP);
}

export function clampReceiptInlineZoom(value: number) {
  if (!Number.isFinite(value)) return RECEIPT_INLINE_ZOOM_MIN;
  return roundZoom(Math.min(RECEIPT_INLINE_ZOOM_MAX, Math.max(RECEIPT_INLINE_ZOOM_MIN, value)));
}

export function scaledReceiptDisplaySize(size: { width: number; height: number }, zoom: number) {
  const scale = clampReceiptInlineZoom(zoom);
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}

export function containedReceiptBaseSize(
  rotation: number,
  box: { w: number; h: number },
  natural: { w: number; h: number },
) {
  if (!box.w || !box.h || !natural.w || !natural.h) return null;
  const rotated = Math.abs(rotation) % 180 !== 0;
  const scale = rotated ? Math.min(box.w / natural.h, box.h / natural.w) : Math.min(box.w / natural.w, box.h / natural.h);
  return {
    width: Math.round(natural.w * scale),
    height: Math.round(natural.h * scale),
  };
}

export function receiptScrollFrameSize(size: { width: number; height: number }, rotation: number, zoom: number) {
  const scaled = scaledReceiptDisplaySize(size, zoom);
  const rotated = Math.abs(rotation) % 180 !== 0;
  return rotated ? { width: scaled.height, height: scaled.width } : scaled;
}

export function isReceiptInlineZoomed(zoom: number) {
  return clampReceiptInlineZoom(zoom) > RECEIPT_INLINE_ZOOM_MIN;
}

export function shouldUpdateReceiptMeasure(zoom: number) {
  return clampReceiptInlineZoom(zoom) === RECEIPT_INLINE_ZOOM_MIN;
}

export function receiptImageClickRatio(click: ReceiptPoint, imageSize: ReceiptSize): ReceiptPointRatio {
  return {
    x: clampRatio(safeDivide(click.x, imageSize.width)),
    y: clampRatio(safeDivide(click.y, imageSize.height)),
  };
}

export function receiptViewportCenterRatio(input: {
  rotation: number;
  baseSize: ReceiptSize;
  zoom: number;
  viewport: ReceiptViewport;
  scroll: ReceiptScrollPosition;
}): ReceiptPointRatio {
  const imageSize = scaledReceiptDisplaySize(input.baseSize, input.zoom);
  const frameSize = receiptScrollFrameSize(input.baseSize, input.rotation, input.zoom);
  const framePoint = {
    x: input.scroll.left + input.viewport.width / 2,
    y: input.scroll.top + input.viewport.height / 2,
  };
  const centered = {
    x: framePoint.x - frameSize.width / 2,
    y: framePoint.y - frameSize.height / 2,
  };
  const imagePoint = unrotatePoint(centered, input.rotation);
  return {
    x: clampRatio((imagePoint.x + imageSize.width / 2) / imageSize.width),
    y: clampRatio((imagePoint.y + imageSize.height / 2) / imageSize.height),
  };
}

export function receiptCenteredScrollTarget(input: {
  rotation: number;
  baseSize: ReceiptSize;
  zoom: number;
  viewport: ReceiptViewport;
  pointRatio: ReceiptPointRatio;
}) {
  const imageSize = scaledReceiptDisplaySize(input.baseSize, input.zoom);
  const frameSize = receiptScrollFrameSize(input.baseSize, input.rotation, input.zoom);
  const imagePoint = {
    x: clampRatio(input.pointRatio.x) * imageSize.width - imageSize.width / 2,
    y: clampRatio(input.pointRatio.y) * imageSize.height - imageSize.height / 2,
  };
  const framePoint = rotatePoint(imagePoint, input.rotation);
  const targetPoint = {
    x: framePoint.x + frameSize.width / 2,
    y: framePoint.y + frameSize.height / 2,
  };

  return {
    scrollLeft: clamp(targetPoint.x - input.viewport.width / 2, 0, Math.max(0, frameSize.width - input.viewport.width)),
    scrollTop: clamp(targetPoint.y - input.viewport.height / 2, 0, Math.max(0, frameSize.height - input.viewport.height)),
    targetPoint,
    scrollSize: frameSize,
  };
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

function safeDivide(value: number, divisor: number) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) return 0;
  return value / divisor;
}

function clampRatio(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rotatePoint(point: ReceiptPoint, rotation: number): ReceiptPoint {
  switch (normalizedQuarterTurn(rotation)) {
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
    default:
      return point;
  }
}

function unrotatePoint(point: ReceiptPoint, rotation: number): ReceiptPoint {
  switch (normalizedQuarterTurn(rotation)) {
    case 90:
      return { x: point.y, y: -point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: -point.y, y: point.x };
    default:
      return point;
  }
}

function normalizedQuarterTurn(rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}
