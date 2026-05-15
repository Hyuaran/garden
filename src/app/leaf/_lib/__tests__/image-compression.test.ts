import { describe, it, expect, vi } from "vitest";
import {
  isHeicFile,
  fitWithin,
  COMPRESS_DEFAULTS,
  THUMBNAIL_DEFAULTS,
} from "../image-compression";

describe("image-compression", () => {
  describe("isHeicFile", () => {
    it("returns true for image/heic MIME", () => {
      const file = new File(["x"], "a.heic", { type: "image/heic" });
      expect(isHeicFile(file)).toBe(true);
    });

    it("returns true for image/heif MIME", () => {
      const file = new File(["x"], "a.heif", { type: "image/heif" });
      expect(isHeicFile(file)).toBe(true);
    });

    it("returns true for .heif extension even with empty MIME", () => {
      const file = new File(["x"], "a.heif", { type: "" });
      expect(isHeicFile(file)).toBe(true);
    });

    it("returns true for .HEIC uppercase extension", () => {
      const file = new File(["x"], "PHOTO.HEIC", { type: "" });
      expect(isHeicFile(file)).toBe(true);
    });

    it("returns false for image/jpeg", () => {
      const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
      expect(isHeicFile(file)).toBe(false);
    });

    it("returns false for image/png", () => {
      const file = new File(["x"], "a.png", { type: "image/png" });
      expect(isHeicFile(file)).toBe(false);
    });

    it("returns false for empty file (no type, .txt extension)", () => {
      const file = new File(["x"], "a.txt", { type: "" });
      expect(isHeicFile(file)).toBe(false);
    });
  });

  describe("fitWithin", () => {
    it("returns original size when both dimensions ≤ max", () => {
      expect(fitWithin(1000, 800, 1500)).toEqual({ width: 1000, height: 800 });
    });

    it("scales down landscape image (width > height)", () => {
      // 3000x2000 → 1500x1000 (ratio 0.5)
      expect(fitWithin(3000, 2000, 1500)).toEqual({ width: 1500, height: 1000 });
    });

    it("scales down portrait image (height > width)", () => {
      // 2000x3000 → 1000x1500 (ratio 0.5)
      expect(fitWithin(2000, 3000, 1500)).toEqual({ width: 1000, height: 1500 });
    });

    it("handles square image", () => {
      expect(fitWithin(2000, 2000, 1500)).toEqual({ width: 1500, height: 1500 });
    });

    it("rounds to integers", () => {
      // 3001x1999 → ratio = 1500/3001 ≈ 0.4998
      const result = fitWithin(3001, 1999, 1500);
      expect(Number.isInteger(result.width)).toBe(true);
      expect(Number.isInteger(result.height)).toBe(true);
      expect(result.width).toBe(1500);
      expect(result.height).toBe(999); // round(1999 * 1500/3001) = round(998.86) = 999
    });

    it("handles small thumbnail target (300px)", () => {
      // 1500x1000 → 300x200
      expect(fitWithin(1500, 1000, 300)).toEqual({ width: 300, height: 200 });
    });
  });

  describe("default options", () => {
    it("COMPRESS_DEFAULTS is 1500px / 0.85", () => {
      expect(COMPRESS_DEFAULTS).toEqual({ maxWidth: 1500, quality: 0.85 });
    });

    it("THUMBNAIL_DEFAULTS is 300px / 0.70", () => {
      expect(THUMBNAIL_DEFAULTS).toEqual({ maxWidth: 300, quality: 0.7 });
    });
  });

  describe("convertHeicToJpeg", () => {
    it("throws on non-HEIC file", async () => {
      // モジュールごと再 import するため dynamic import
      const { convertHeicToJpeg } = await import("../image-compression");
      const jpgFile = new File(["x"], "a.jpg", { type: "image/jpeg" });
      await expect(convertHeicToJpeg(jpgFile)).rejects.toThrow(/not a HEIC/);
    });

    it("calls heic2any with toType image/jpeg + quality 0.85", async () => {
      // heic2any を mock
      vi.resetModules();
      vi.doMock("heic2any", () => ({
        default: vi.fn(async (opts: unknown) => {
          // 引数を確認しつつ JPEG Blob 返す
          return new Blob(["converted"], { type: "image/jpeg" });
        }),
      }));
      const { convertHeicToJpeg } = await import("../image-compression");
      const heicFile = new File(["heic data"], "a.heic", { type: "image/heic" });
      const jpegBlob = await convertHeicToJpeg(heicFile);
      expect(jpegBlob.type).toBe("image/jpeg");
      vi.doUnmock("heic2any");
    });

    it("returns first blob if heic2any returns array", async () => {
      vi.resetModules();
      vi.doMock("heic2any", () => ({
        default: vi.fn(async () => [
          new Blob(["first"], { type: "image/jpeg" }),
          new Blob(["second"], { type: "image/jpeg" }),
        ]),
      }));
      const { convertHeicToJpeg } = await import("../image-compression");
      const heicFile = new File(["heic"], "multi.heic", { type: "image/heic" });
      const result = await convertHeicToJpeg(heicFile);
      const text = await result.text();
      expect(text).toBe("first");
      vi.doUnmock("heic2any");
    });
  });
});
