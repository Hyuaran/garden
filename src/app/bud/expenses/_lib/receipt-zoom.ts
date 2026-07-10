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

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}
