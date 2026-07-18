import { describe, expect, it, vi } from "vitest";
import { isAccessTokenCacheValid, isNewerTokenExpiry, SingleFlight } from "../token-cache";

describe("Rill Mail access-token cache", () => {
  const now = Date.parse("2026-07-18T04:00:00.000Z");

  it("uses cache only when more than five minutes remain", () => {
    expect(isAccessTokenCacheValid("2026-07-18T04:05:00.001Z", now)).toBe(true);
    expect(isAccessTokenCacheValid("2026-07-18T04:05:00.000Z", now)).toBe(false);
    expect(isAccessTokenCacheValid("2026-07-18T03:59:59.000Z", now)).toBe(false);
    expect(isAccessTokenCacheValid(null, now)).toBe(false);
  });

  it("accepts only a strictly newer expiry for conditional cache updates", () => {
    expect(isNewerTokenExpiry("2026-07-18T05:00:00Z", "2026-07-18T04:59:59Z")).toBe(true);
    expect(isNewerTokenExpiry("2026-07-18T05:00:00Z", "2026-07-18T05:00:00Z")).toBe(false);
    expect(isNewerTokenExpiry("2026-07-18T04:00:00Z", "2026-07-18T05:00:00Z")).toBe(false);
  });

  it("coalesces concurrent refreshes into one grant", async () => {
    const flight = new SingleFlight<string>();
    const grant = vi.fn(async () => {
      await Promise.resolve();
      return "access-token";
    });
    const results = await Promise.all([flight.run("user-1", grant), flight.run("user-1", grant), flight.run("user-1", grant)]);
    expect(results).toEqual(["access-token", "access-token", "access-token"]);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce different users", async () => {
    const flight = new SingleFlight<string>();
    const grant = vi.fn(async (value: string) => value);
    await Promise.all([flight.run("user-1", () => grant("one")), flight.run("user-2", () => grant("two"))]);
    expect(grant).toHaveBeenCalledTimes(2);
  });
});
