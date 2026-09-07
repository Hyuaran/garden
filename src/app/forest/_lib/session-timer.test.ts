import { describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  isForestUnlocked: () => true,
  touchForestSession: vi.fn(),
}));

import { isSessionTimerExcluded } from "./session-timer";

describe("Forest session timer", () => {
  it("excludes the kanri monitor display path", () => {
    expect(isSessionTimerExcluded("/system/kanri/display")).toBe(true);
    expect(isSessionTimerExcluded("/forest")).toBe(false);
  });
});
