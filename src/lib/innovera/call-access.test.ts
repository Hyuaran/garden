import { describe, expect, it } from "vitest";

import {
  canPlayAllRecordings,
  canSeeAllCalls,
  canUseCallScreen,
  defaultCallRecordingAccess,
  resolveCallRecordingAccess,
  type CallRecordingAccess,
} from "./call-access";
import type { GardenRole } from "@/app/root/_constants/types";

describe("call recording access", () => {
  it.each<[GardenRole, CallRecordingAccess]>([
    ["toss", "own"],
    ["closer", "own"],
    ["cs", "own"],
    ["staff", "all_history_own_audio"],
    ["outsource", "own"],
    ["manager", "all"],
    ["admin", "all"],
    ["super_admin", "all"],
  ])("resolves the role default for %s", (role, expected) => {
    expect(defaultCallRecordingAccess(role)).toBe(expected);
  });

  it.each<CallRecordingAccess>([
    "all",
    "all_history_own_audio",
    "own",
    "none",
  ])("uses explicit override %s", (override) => {
    expect(resolveCallRecordingAccess("manager", override)).toBe(override);
  });

  it.each([undefined, null, "default", "invalid"])(
    "falls back to the role default for %s",
    (override) => {
      expect(
        resolveCallRecordingAccess(
          "cs",
          override as Parameters<typeof resolveCallRecordingAccess>[1],
        ),
      ).toBe("own");
    },
  );

  it("checks call history and recording capabilities", () => {
    expect(canSeeAllCalls("all")).toBe(true);
    expect(canSeeAllCalls("all_history_own_audio")).toBe(true);
    expect(canSeeAllCalls("own")).toBe(false);
    expect(canPlayAllRecordings("all")).toBe(true);
    expect(canPlayAllRecordings("all_history_own_audio")).toBe(false);
    expect(canUseCallScreen("none")).toBe(false);
    expect(canUseCallScreen("own")).toBe(true);
  });
});
