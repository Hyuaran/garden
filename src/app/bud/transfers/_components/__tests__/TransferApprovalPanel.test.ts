import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyTransferUrgency } from "../../_lib/approval-urgency";

describe("classifyTransferUrgency", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("予定日を今日以前・7日以内、8〜30日、31日以降に分類する", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T03:00:00.000Z"));

    expect(classifyTransferUrgency("2026-07-13")).toBe("urgent");
    expect(classifyTransferUrgency("2026-07-21")).toBe("urgent");
    expect(classifyTransferUrgency("2026-07-22")).toBe("normal");
    expect(classifyTransferUrgency("2026-08-13")).toBe("normal");
    expect(classifyTransferUrgency("2026-08-14")).toBe("later");
  });
});
