import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/app/bloom/_lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import {
  clearRootUnlock,
  getSessionElapsedMs,
  isRootUnlocked,
  touchRootSession,
} from "../auth";
import {
  clearAuthSession,
  unlockAuthSession,
} from "@/app/_lib/auth-unified";

describe("Root unified unlock session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("uses the unified root unlock key", () => {
    unlockAuthSession("root");

    expect(isRootUnlocked()).toBe(true);
    expect(sessionStorage.getItem("root:unlockedAt")).toBeTruthy();
    expect(sessionStorage.getItem("rootUnlockedAt")).toBeNull();
  });

  it("ignores the legacy root unlock key", () => {
    sessionStorage.setItem("rootUnlockedAt", Date.now().toString());

    expect(isRootUnlocked()).toBe(false);
    expect(getSessionElapsedMs()).toBe(0);
  });

  it("reads elapsed time from the unified root unlock key", () => {
    unlockAuthSession("root");

    expect(getSessionElapsedMs()).toBeGreaterThanOrEqual(0);
    expect(sessionStorage.getItem("rootUnlockedAt")).toBeNull();
  });

  it("touches and clears only the unified root unlock", () => {
    unlockAuthSession("root");
    const before = sessionStorage.getItem("root:unlockedAt");

    touchRootSession();
    expect(sessionStorage.getItem("root:unlockedAt")).toBeTruthy();

    clearRootUnlock();
    expect(sessionStorage.getItem("root:unlockedAt")).toBeNull();
    expect(before).toBeTruthy();
  });

  it("does not report unlocked after unified clear", () => {
    unlockAuthSession("root");
    clearAuthSession("root");

    expect(isRootUnlocked()).toBe(false);
  });
});
