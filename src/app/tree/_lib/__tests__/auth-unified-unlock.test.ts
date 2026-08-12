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
  clearTreeUnlock,
  isTreeUnlocked,
  markTreeUnlocked,
  touchTreeSession,
} from "../auth";

describe("Tree unified unlock session", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("marks a resumed session with the unified tree key", () => {
    markTreeUnlocked();

    expect(isTreeUnlocked()).toBe(true);
    expect(sessionStorage.getItem("tree:unlockedAt")).toBeTruthy();
    expect(sessionStorage.getItem("treeUnlockedAt")).toBeNull();
  });

  it("reports an expired unlock as locked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
    sessionStorage.setItem(
      "tree:unlockedAt",
      (Date.now() - 2 * 60 * 60 * 1000).toString(),
    );

    expect(isTreeUnlocked()).toBe(false);
  });

  it("touches and clears only the unified tree unlock", () => {
    markTreeUnlocked();
    sessionStorage.setItem("bloom:unlockedAt", "123");

    touchTreeSession();
    expect(sessionStorage.getItem("tree:unlockedAt")).toBeTruthy();

    clearTreeUnlock();
    expect(sessionStorage.getItem("tree:unlockedAt")).toBeNull();
    expect(sessionStorage.getItem("bloom:unlockedAt")).toBe("123");
  });
});
