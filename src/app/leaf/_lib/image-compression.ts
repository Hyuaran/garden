/**
 * Garden-Leaf 関電業務委託 — 画像圧縮 + サムネ + HEIC 変換
 *
 * spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3.1
 * - 本体: 1500px JPEG85%
 * - サムネ: 300px JPEG70%
 * - HEIC: heic2any で JPEG に変換してから Canvas 圧縮（iPhone 撮影対応）
 *
 * 実装方針:
 * - main thread 版（compressImage / generateThumbnail / convertHeicToJpeg）と
 *   Web Worker ラッパ版（compressWithWorker / thumbnailWithWorker）を併設
 * - Worker 版は 15 枚一気選択時に main thread をブロックしないため
 * - Worker が利用不可（SSR / 古いブラウザ）の場合は main thread 版にフォールバック
 *
 * see:
 *   - spec §3.1 (Upload フロー)
 *   - plan v3 §Task D.6 / D.7
 */

import heic2any from "heic2any";

// ─── HEIC 判定 ──────────────────────────────────────────────────────────────
/** HEIC / HEIF ファイル判定（MIME or 拡張子）*/
export function isHeicFile(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

// ─── HEIC → JPEG 変換 ───────────────────────────────────────────────────────
/**
 * HEIC/HEIF ファイルを JPEG Blob に変換する。
 * 呼出側で `isHeicFile()` で事前判定すること（非 HEIC は throw）。
 *
 * @throws 非 HEIC ファイル / heic2any 変換失敗
 */
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  if (!isHeicFile(file)) {
    throw new Error("convertHeicToJpeg: not a HEIC/HEIF file");
  }
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.85,
  });
  // heic2any は複数画像 HEIC では Blob[] を返すが、iPhone 撮影の単一画像では Blob 単体
  return Array.isArray(result) ? result[0] : result;
}

// ─── 圧縮オプション ─────────────────────────────────────────────────────────
export type CompressOptions = {
  /** 出力画像の長辺 (px)、`fitWithin` で縦横比維持 */
  maxWidth: number;
  /** JPEG 品質 (0-1)、Canvas#toBlob の第 3 引数 */
  quality: number;
};

/** A-1c 既定: 本体 1500px / 品質 0.85 */
export const COMPRESS_DEFAULTS: CompressOptions = {
  maxWidth: 1500,
  quality: 0.85,
};

/** A-1c 既定: サムネ 300px / 品質 0.70 */
export const THUMBNAIL_DEFAULTS: CompressOptions = {
  maxWidth: 300,
  quality: 0.7,
};

// ─── main thread 版 (Worker フォールバック / 単体テスト用) ─────────────────────
/**
 * 長辺 `opts.maxWidth` に縮小し JPEG にエンコード（main thread 版）。
 * Worker が使えない環境（SSR / 古いブラウザ）でフォールバックとして使用。
 */
export async function compressImage(
  source: Blob | File,
  opts: CompressOptions = COMPRESS_DEFAULTS,
): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const { width, height } = fitWithin(img.width, img.height, opts.maxWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("compressImage: no 2d context");
    ctx.drawImage(img, 0, 0, width, height);
    return await toBlob(canvas, "image/jpeg", opts.quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** サムネ生成 (300px / 0.70 既定、main thread 版) */
export async function generateThumbnail(source: Blob | File): Promise<Blob> {
  return compressImage(source, THUMBNAIL_DEFAULTS);
}

// ─── Worker 経由 ─────────────────────────────────────────────────────────────
/**
 * Worker 経由の高速圧縮 API。ブラウザ環境専用。
 * Worker が使えない場合は `compressImage` (main thread 版) にフォールバック。
 */
export async function compressWithWorker(
  blob: Blob,
  opts: CompressOptions = COMPRESS_DEFAULTS,
): Promise<Blob> {
  if (!isWorkerSupported()) {
    return compressImage(blob, opts);
  }
  return callWorker({ type: "compress", blob, opts });
}

export async function thumbnailWithWorker(blob: Blob): Promise<Blob> {
  if (!isWorkerSupported()) {
    return generateThumbnail(blob);
  }
  return callWorker({ type: "thumbnail", blob });
}

// ─── Worker 内部実装 ────────────────────────────────────────────────────────
type WorkerCall =
  | { type: "compress"; blob: Blob; opts: CompressOptions }
  | { type: "thumbnail"; blob: Blob }
  | { type: "heic"; blob: Blob };

let _workerInstance: Worker | null = null;

function isWorkerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

function getWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(
      new URL("./image-compression.worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return _workerInstance;
}

function callWorker(call: WorkerCall): Promise<Blob> {
  const worker = getWorker();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const handler = (
      e: MessageEvent<{
        id: string;
        ok: boolean;
        blob?: Blob;
        error?: string;
      }>,
    ) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", handler);
      if (e.data.ok && e.data.blob) resolve(e.data.blob);
      else reject(new Error(e.data.error ?? "worker error"));
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id, ...call });
  });
}

// ─── 内部ヘルパ ──────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("loadImage failed"));
    img.src = src;
  });
}

/** 縦横比を維持して、指定された最大辺長以下に収める */
export function fitWithin(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("toBlob failed"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}
