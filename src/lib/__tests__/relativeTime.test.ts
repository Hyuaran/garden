/**
 * Garden 共通ヘルパー — formatRelativeTime regression test
 *
 * 配置目的:
 *   Bloom-002 Phase 4 が src/lib/relativeTime.ts に formatRelativeTime を実装した時点で、
 *   ShojiStatusWidget が利用する相対時刻文言を回帰固定する。
 *
 * 仕様（先行 spec）:
 *   - 引数: (target: Date, now: Date) → string
 *   - 0 分    → "今"
 *   - 1〜59 分 → "N 分前"  (半角数字 + 半角スペース + 「分前」)
 *   - 1〜23 時間 → "N 時間前"
 *   - 1〜29 日  → "N 日前"
 *   - 30 日以上  → "N ヶ月前"  (30 日 = 1 ヶ月)
 *
 * 注意:
 *   - import path はテスト先行のため仮置き
 *   - 「N」と単位の間にスペースを入れる方針（テストもスペース有り）
 */

import { describe, it, expect } from "vitest";

// 仮 path: Bloom-002 で `src/lib/relativeTime.ts` を作成する前提。
import { formatRelativeTime } from "@/lib/relativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-26T12:00:00+09:00");

  it("0 分前 → 「今」", () => {
    expect(formatRelativeTime(now, now)).toBe("今");
  });

  it("5 分前 → 「5 分前」", () => {
    const past = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("5 分前");
  });

  it("30 分前 → 「30 分前」", () => {
    const past = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("30 分前");
  });

  it("1 時間前 → 「1 時間前」", () => {
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("1 時間前");
  });

  it("1 日前 → 「1 日前」", () => {
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("1 日前");
  });

  it("7 日前 → 「7 日前」", () => {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("7 日前");
  });

  it("1 ヶ月前 → 「1 ヶ月前」", () => {
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(past, now)).toBe("1 ヶ月前");
  });
});
