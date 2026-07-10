export const RECEIPT_INLINE_ZOOM_MIN = 1;
export const RECEIPT_INLINE_ZOOM_MAX = 2.4;
export const RECEIPT_INLINE_ZOOM_STEP = 0.2;

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

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}
