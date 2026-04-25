/**
 * attachments.ts のユニットテスト。
 * pure function 中心 + 簡単な Supabase mock。
 * UI / Storage / RPC の完全な動作確認は Phase A の RTL テストでカバー。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateAttachmentId,
  getUploadConcurrency,
  isMobileDevice,
} from "../attachments";

describe("attachments — pure functions", () => {
  describe("generateAttachmentId", () => {
    it("returns a UUID v4 string (36 chars, 4 hyphens)", () => {
      const id = generateAttachmentId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("returns unique IDs", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) ids.add(generateAttachmentId());
      expect(ids.size).toBe(100);
    });
  });

  describe("isMobileDevice", () => {
    const originalUA = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUA,
        configurable: true,
      });
    });

    it("returns true for iPhone UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        configurable: true,
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("returns true for iPad UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
        configurable: true,
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("returns true for Android UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 14; Pixel 7)",
        configurable: true,
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("returns false for Windows desktop UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        configurable: true,
      });
      expect(isMobileDevice()).toBe(false);
    });

    it("returns false for macOS desktop UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        configurable: true,
      });
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe("getUploadConcurrency", () => {
    const originalUA = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUA,
        configurable: true,
      });
      delete (navigator as unknown as { connection?: unknown }).connection;
    });

    it("returns 2 for mobile UA", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        configurable: true,
      });
      expect(getUploadConcurrency()).toBe(2);
    });

    it("returns 2 for 3g connection (no mobile UA)", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      Object.defineProperty(navigator, "connection", {
        value: { effectiveType: "3g" },
        configurable: true,
      });
      expect(getUploadConcurrency()).toBe(2);
    });

    it("returns 2 for 4g connection (no mobile UA)", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      Object.defineProperty(navigator, "connection", {
        value: { effectiveType: "4g" },
        configurable: true,
      });
      expect(getUploadConcurrency()).toBe(2);
    });

    it("returns 3 for desktop UA without connection info (iOS Safari fallback)", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      delete (navigator as unknown as { connection?: unknown }).connection;
      expect(getUploadConcurrency()).toBe(3);
    });

    it("returns 3 for desktop UA with wifi (effectiveType undefined)", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh)",
        configurable: true,
      });
      Object.defineProperty(navigator, "connection", {
        value: {},
        configurable: true,
      });
      expect(getUploadConcurrency()).toBe(3);
    });
  });
});

// ─── Supabase mock を使った関数のテスト ─────────────────────────────────────
import { createLeafSupabaseMock } from "@/test-utils/leaf-supabase-mock";

vi.mock("@/lib/supabase/client", () => {
  const supabase = (globalThis as unknown as { __mockClient?: unknown })
    .__mockClient;
  return {
    getSupabaseClient: () => supabase,
    supabase,
  };
});

describe("attachments — Supabase-dependent functions", () => {
  beforeEach(() => {
    const m = createLeafSupabaseMock();
    (globalThis as unknown as { __mockClient: unknown }).__mockClient =
      m.client;
  });

  describe("verifyImageDownloadPassword", () => {
    it("returns true when RPC returns data: true", async () => {
      const { verifyImageDownloadPassword } = await import("../attachments");
      const result = await verifyImageDownloadPassword("correct-pw");
      expect(result).toBe(true);
    });
  });

  describe("getCurrentGardenRole", () => {
    it("returns null when no user", async () => {
      const { getCurrentGardenRole } = await import("../attachments");
      const result = await getCurrentGardenRole();
      expect(result).toBeNull();
    });
  });
});
