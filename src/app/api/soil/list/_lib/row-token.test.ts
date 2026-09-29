import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { ROW_TOKEN_MAX_AGE_MS, issueRowTokenWithKey, readRowTokenWithKey } from "./row-token";

const key = Buffer.from(crypto.hkdfSync("sha256", Buffer.from("test-service-role-key"), "soil-list-row-token", "v1", 32));
const otherKey = Buffer.from(crypto.hkdfSync("sha256", Buffer.from("other-service-role-key"), "soil-list-row-token", "v1", 32));

describe("soil list row token", () => {
  it("reads back the same phone number", () => {
    const token = issueRowTokenWithKey("0721234581", key, 1000);

    expect(readRowTokenWithKey(token, key, 1000)).toBe("0721234581");
  });

  it("returns null when one token character is changed", () => {
    const token = issueRowTokenWithKey("0721234581", key, 1000);
    const index = Math.floor(token.length / 2);
    const replacement = token[index] === "A" ? "B" : "A";
    const broken = `${token.slice(0, index)}${replacement}${token.slice(index + 1)}`;

    expect(readRowTokenWithKey(broken, key, 1000)).toBeNull();
  });

  it("returns null after 12 hours", () => {
    const token = issueRowTokenWithKey("0721234581", key, 1000);

    expect(readRowTokenWithKey(token, key, 1000 + ROW_TOKEN_MAX_AGE_MS + 1)).toBeNull();
  });

  it("returns null for a token made with another key", () => {
    const token = issueRowTokenWithKey("0721234581", otherKey, 1000);

    expect(readRowTokenWithKey(token, key, 1000)).toBeNull();
  });

  it("returns null for non-numeric phone values", () => {
    const token = issueRowTokenWithKey("072-123-4581", key, 1000);

    expect(readRowTokenWithKey(token, key, 1000)).toBeNull();
  });
});
