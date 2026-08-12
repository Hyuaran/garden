import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/app/bloom/_lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

import {
  clearBloomUnlock,
  isBloomUnlocked,
  markBloomUnlocked,
  touchBloomSession,
} from "../auth";

describe("Bloom unified unlock session", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("marks a resumed session with the unified bloom key", () => {
    markBloomUnlocked();

    expect(isBloomUnlocked()).toBe(true);
    expect(sessionStorage.getItem("bloom:unlockedAt")).toBeTruthy();
  });

  it("reports an expired unlock as locked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
    sessionStorage.setItem(
      "bloom:unlockedAt",
      (Date.now() - 2 * 60 * 60 * 1000).toString(),
    );

    expect(isBloomUnlocked()).toBe(false);
  });

  it("touches and clears only the unified bloom unlock", () => {
    markBloomUnlocked();
    sessionStorage.setItem("tree:unlockedAt", "123");

    touchBloomSession();
    expect(sessionStorage.getItem("bloom:unlockedAt")).toBeTruthy();

    clearBloomUnlock();
    expect(sessionStorage.getItem("bloom:unlockedAt")).toBeNull();
    expect(sessionStorage.getItem("tree:unlockedAt")).toBe("123");
  });
});
