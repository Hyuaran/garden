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
  clearBudUnlock,
  isBudUnlocked,
  touchBudSession,
} from "../auth";
import {
  clearAuthSession,
  unlockAuthSession,
} from "@/app/_lib/auth-unified";

describe("Bud unified unlock session", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("uses the unified bud unlock key", () => {
    unlockAuthSession("bud");

    expect(isBudUnlocked()).toBe(true);
    expect(window.sessionStorage.getItem("bud:unlockedAt")).toBeTruthy();
    expect(window.sessionStorage.getItem("budUnlockedAt")).toBeNull();
  });

  it("touches and clears only the unified bud unlock", () => {
    unlockAuthSession("bud");
    const before = window.sessionStorage.getItem("bud:unlockedAt");

    touchBudSession();
    expect(window.sessionStorage.getItem("bud:unlockedAt")).toBeTruthy();

    clearBudUnlock();
    expect(window.sessionStorage.getItem("bud:unlockedAt")).toBeNull();
    expect(before).toBeTruthy();
  });

  it("does not report unlocked after unified clear", () => {
    unlockAuthSession("bud");
    clearAuthSession("bud");

    expect(isBudUnlocked()).toBe(false);
  });
});
