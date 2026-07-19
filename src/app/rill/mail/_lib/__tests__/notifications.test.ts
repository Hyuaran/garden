import { describe, expect, it } from "vitest";
import { acceptedNotificationResponse, isPublicNotificationOrigin, notificationIsNew, shouldRenewSubscription, validateClientStates, validationTokenResponse } from "../notifications";

describe("Rill Mail change notifications", () => {
  it("renews missing, expired and near-expiry subscriptions", () => {
    const now = Date.parse("2026-07-19T00:00:00Z");
    expect(shouldRenewSubscription(null, now)).toBe(true);
    expect(shouldRenewSubscription("2026-07-19T00:00:00Z", now)).toBe(true);
    expect(shouldRenewSubscription("2026-07-19T23:59:59Z", now)).toBe(true);
    expect(shouldRenewSubscription("2026-07-20T00:00:01Z", now)).toBe(false);
  });

  it("refreshes only for a newer notification flag", () => {
    expect(notificationIsNew(null, null)).toBe(false);
    expect(notificationIsNew(null, "2026-07-19T00:00:00Z")).toBe(true);
    expect(notificationIsNew("2026-07-19T00:00:00Z", "2026-07-19T00:00:00Z")).toBe(false);
    expect(notificationIsNew("2026-07-19T00:00:00Z", "2026-07-19T00:00:01Z")).toBe(true);
  });

  it("accepts only matching clientState values", () => {
    const states = new Map([["sub-1", "secret-1"]]);
    expect(validateClientStates([{ subscriptionId: "sub-1", clientState: "secret-1" }], states)).toBe(true);
    expect(validateClientStates([{ subscriptionId: "sub-1", clientState: "wrong" }], states)).toBe(false);
    expect(validateClientStates([], states)).toBe(false);
  });

  it("echoes validationToken and returns 202 for accepted notifications", async () => {
    const validation = validationTokenResponse("graph-token");
    expect(validation?.status).toBe(200);
    expect(validation?.headers.get("content-type")).toContain("text/plain");
    expect(await validation?.text()).toBe("graph-token");
    expect(acceptedNotificationResponse().status).toBe(202);
  });

  it("skips localhost subscription creation", () => {
    expect(isPublicNotificationOrigin("https://garden.example.com")).toBe(true);
    expect(isPublicNotificationOrigin("http://localhost:3000")).toBe(false);
  });
});
