import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
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
  clearForestUnlock,
  isForestUnlocked,
  touchForestSession,
} from "../auth";
import {
  clearAuthSession,
  unlockAuthSession,
} from "@/app/_lib/auth-unified";

describe("Forest unified unlock session", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("uses the unified forest unlock key", () => {
    unlockAuthSession("forest");

    expect(isForestUnlocked()).toBe(true);
    expect(window.sessionStorage.getItem("forest:unlockedAt")).toBeTruthy();
    expect(window.sessionStorage.getItem("forestUnlockedAt")).toBeNull();
  });

  it("touches and clears only the unified forest unlock", () => {
    unlockAuthSession("forest");
    const before = window.sessionStorage.getItem("forest:unlockedAt");

    touchForestSession();
    expect(window.sessionStorage.getItem("forest:unlockedAt")).toBeTruthy();

    clearForestUnlock();
    expect(window.sessionStorage.getItem("forest:unlockedAt")).toBeNull();
    expect(before).toBeTruthy();
  });

  it("does not report unlocked after unified clear", () => {
    unlockAuthSession("forest");
    clearAuthSession("forest");

    expect(isForestUnlocked()).toBe(false);
  });
});
