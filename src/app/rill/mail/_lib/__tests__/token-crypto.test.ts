import { afterEach, describe, expect, it } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "../token-crypto";

describe("refresh token encryption", () => {
  afterEach(() => { delete process.env.RILL_TOKEN_ENC_KEY; });
  it("round trips without storing plaintext", () => {
    process.env.RILL_TOKEN_ENC_KEY = "test-only-key";
    const encrypted = encryptRefreshToken("secret-refresh-token");
    expect(encrypted).not.toContain("secret-refresh-token");
    expect(decryptRefreshToken(encrypted)).toBe("secret-refresh-token");
  });
  it("rejects tampering", () => {
    process.env.RILL_TOKEN_ENC_KEY = "test-only-key";
    const encrypted = encryptRefreshToken("secret");
    const pieces = encrypted.split(".");
    pieces[3] = `${pieces[3][0] === "A" ? "B" : "A"}${pieces[3].slice(1)}`;
    expect(() => decryptRefreshToken(pieces.join("."))).toThrow();
  });
});
