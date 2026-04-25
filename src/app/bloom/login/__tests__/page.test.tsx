/**
 * /bloom/login の returnTo 検証関数テスト + 基本レンダリングテスト
 *
 * 想定実行: `npx vitest run src/app/bloom/login` （npm install 後）
 */

import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "../page";

describe("sanitizeReturnTo (Bloom)", () => {
  it("null は /bloom にフォールバック", () => {
    expect(sanitizeReturnTo(null)).toBe("/bloom");
  });

  it("空文字は /bloom にフォールバック", () => {
    expect(sanitizeReturnTo("")).toBe("/bloom");
  });

  it("/bloom そのものは許可", () => {
    expect(sanitizeReturnTo("/bloom")).toBe("/bloom");
  });

  it("/bloom/workboard などサブパスは許可", () => {
    expect(sanitizeReturnTo("/bloom/workboard")).toBe("/bloom/workboard");
    expect(sanitizeReturnTo("/bloom/monthly-digest/2026-04")).toBe(
      "/bloom/monthly-digest/2026-04",
    );
  });

  it("クエリパラメータ付きの /bloom も許可", () => {
    expect(sanitizeReturnTo("/bloom?foo=bar")).toBe("/bloom?foo=bar");
  });

  it("/forest など他モジュールは /bloom にフォールバック", () => {
    expect(sanitizeReturnTo("/forest")).toBe("/bloom");
    expect(sanitizeReturnTo("/forest/dashboard")).toBe("/bloom");
    expect(sanitizeReturnTo("/tree/dashboard")).toBe("/bloom");
  });

  it("絶対 URL（http/https）は拒否し /bloom にフォールバック", () => {
    expect(sanitizeReturnTo("http://evil.example.com/bloom")).toBe("/bloom");
    expect(sanitizeReturnTo("https://example.com/bloom")).toBe("/bloom");
  });

  it("プロトコル相対 URL（//host）は拒否", () => {
    expect(sanitizeReturnTo("//evil.example.com/bloom")).toBe("/bloom");
  });

  it("スラッシュなしのパスは拒否", () => {
    expect(sanitizeReturnTo("bloom/workboard")).toBe("/bloom");
  });

  it("javascript: スキームは拒否", () => {
    // 大文字小文字混合を含む
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/bloom");
    expect(sanitizeReturnTo("JavaScript:alert(1)")).toBe("/bloom");
  });
});
