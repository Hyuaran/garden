import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_SESSION_TIMEOUT_MS,
  DEVELOPMENT_TIMER_POLL_INTERVAL_MS,
  DEVELOPMENT_WARNING_OFFSET_MS,
  PRODUCTION_SESSION_TIMEOUT_MS,
  PRODUCTION_WARNING_OFFSET_MS,
} from "./session-timer";

describe("Root session timer constants", () => {
  it("開発値は5分・残り1分・監視1秒", () => {
    expect(DEVELOPMENT_SESSION_TIMEOUT_MS).toBe(5 * 60 * 1000);
    expect(DEVELOPMENT_WARNING_OFFSET_MS).toBe(60 * 1000);
    expect(DEVELOPMENT_TIMER_POLL_INTERVAL_MS).toBe(1000);
  });

  it("本番値は2時間・残り10分のまま", () => {
    expect(PRODUCTION_SESSION_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000);
    expect(PRODUCTION_WARNING_OFFSET_MS).toBe(10 * 60 * 1000);
  });
});
