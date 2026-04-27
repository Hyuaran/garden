/**
 * /forest/login の returnTo 検証関数テスト
 *
 * 想定実行: `npx vitest run src/app/forest/login` （npm install 後）
 */

import { describe, expect, it } from "vitest";

import { sanitizeForestReturnTo } from "../page";

describe("sanitizeForestReturnTo", () => {
  it("null は /forest/dashboard にフォールバック", () => {
    expect(sanitizeForestReturnTo(null)).toBe("/forest/dashboard");
  });

  it("空文字は /forest/dashboard にフォールバック", () => {
    expect(sanitizeForestReturnTo("")).toBe("/forest/dashboard");
  });

  it("/bloom など同一オリジンの path は許可（Forest → Bloom 行き来用）", () => {
    expect(sanitizeForestReturnTo("/bloom")).toBe("/bloom");
    expect(sanitizeForestReturnTo("/bloom/workboard")).toBe("/bloom/workboard");
    expect(sanitizeForestReturnTo("/forest/dashboard")).toBe("/forest/dashboard");
    expect(sanitizeForestReturnTo("/root/employees")).toBe("/root/employees");
  });

  it("絶対 URL（http/https）は拒否", () => {
    expect(sanitizeForestReturnTo("http://evil.example.com/bloom")).toBe(
      "/forest/dashboard",
    );
    expect(sanitizeForestReturnTo("https://attacker.example.com")).toBe(
      "/forest/dashboard",
    );
  });

  it("プロトコル相対 URL（//host）は拒否", () => {
    expect(sanitizeForestReturnTo("//evil.example.com/bloom")).toBe(
      "/forest/dashboard",
    );
  });

  it("スラッシュなしのパスは拒否", () => {
    expect(sanitizeForestReturnTo("bloom")).toBe("/forest/dashboard");
  });

  it("javascript: スキームは拒否", () => {
    expect(sanitizeForestReturnTo("javascript:alert(1)")).toBe(
      "/forest/dashboard",
    );
  });
});
