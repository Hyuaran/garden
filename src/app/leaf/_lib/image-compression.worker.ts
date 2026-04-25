/**
 * Web Worker: 画像圧縮 + サムネ生成 + HEIC 変換
 *
 * main thread から呼出し、重処理を分離することで 15 枚一気選択時も UI が応答する。
 * OffscreenCanvas + createImageBitmap で動作。
 *
 * プロトコル:
 *   入: { id: string; type: 'compress' | 'thumbnail' | 'heic'; blob: Blob; opts?: {...} }
 *   出: { id: string; ok: true; blob: Blob } | { id: string; ok: false; error: string }
 *
 * see:
 *   - docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3.1
 *   - plan v3 §Task D.7
 */

import heic2any from "heic2any";

type WorkerRequest =
  | {
      id: string;
      type: "compress";
      blob: Blob;
      opts: { maxWidth: number; quality: number };
    }
  | { id: string; type: "thumbnail"; blob: Blob }
  | { id: string; type: "heic"; blob: Blob };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === "heic") {
      const res = await heic2any({
        blob: req.blob,
        toType: "image/jpeg",
        quality: 0.85,
      });
      const out = Array.isArray(res) ? res[0] : res;
      self.postMessage({ id: req.id, ok: true, blob: out });
      return;
    }

    const maxWidth = req.type === "thumbnail" ? 300 : req.opts.maxWidth;
    const quality = req.type === "thumbnail" ? 0.7 : req.opts.quality;
    const bitmap = await createImageBitmap(req.blob);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxWidth);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("worker: no 2d context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    self.postMessage({ id: req.id, ok: true, blob });
  } catch (err) {
    self.postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

function fitWithin(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
