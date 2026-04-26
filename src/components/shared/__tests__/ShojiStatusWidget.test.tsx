/**
 * Garden 共通コンポーネント — ShojiStatusWidget regression test
 *
 * 配置目的:
 *   Bloom-002 Phase 4 が src/components/shared/ShojiStatusWidget.tsx を実装した時点で、
 *   compact / full バリアントの表示要件と「stale 表現」を回帰固定する。
 *
 * 前提（実装側に対する要求）:
 *   - props:
 *       - variant: "compact" | "full"
 *       - status: "available" | "busy" | "offline"
 *       - summary?: string  (full 専用)
 *       - updatedAt: Date | string  (ISO)
 *   - compact: バッジ + 相対時刻のみ。summary は出さない
 *   - full:    ステータスラベル + summary + 詳細時刻
 *   - 30 分以上経過した updatedAt は data-stale="true" + グレー化（class または style）
 *
 * 表示文言:
 *   - status='available' バッジラベル: 「対応可」
 *   - status='busy'      バッジラベル: 「作業中」
 *   - status='offline'   バッジラベル: 「不在」
 *
 * 注意:
 *   - import path はテスト先行のため仮置き（Bloom-002 実装側で一致させる）
 *   - 相対時刻 helper は src/lib/relativeTime.ts を内部利用する想定
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// 仮 path: Bloom-002 で `src/components/shared/ShojiStatusWidget.tsx` を作成する前提。
import { ShojiStatusWidget } from "@/components/shared/ShojiStatusWidget";

describe("ShojiStatusWidget", () => {
  it("compact 表示 - status バッジと相対時刻のみ", () => {
    const now = new Date();
    render(
      <ShojiStatusWidget
        variant="compact"
        status="available"
        summary="表示されないはず"
        updatedAt={now}
      />,
    );

    // バッジ「対応可」が表示
    expect(screen.getByText("対応可")).toBeInTheDocument();

    // 相対時刻: 直近なら「今」または「数秒前」
    // 仕様 §4 に従い、formatRelativeTime(now, now) === "今"
    expect(screen.getByText("今")).toBeInTheDocument();

    // summary は表示されない（compact）
    expect(screen.queryByText("表示されないはず")).not.toBeInTheDocument();
  });

  it("full 表示 - status / summary / 詳細時刻が表示", () => {
    const updatedAt = new Date("2026-04-26T12:00:00+09:00");
    render(
      <ShojiStatusWidget
        variant="full"
        status="busy"
        summary="会議中"
        updatedAt={updatedAt}
      />,
    );

    // ステータス「作業中」表示
    expect(screen.getByText("作業中")).toBeInTheDocument();

    // summary 「会議中」表示
    expect(screen.getByText("会議中")).toBeInTheDocument();

    // 詳細時刻が ISO もしくは日本語表記でどこかに含まれる
    // （実装の詳細フォーマットは Bloom-002 側で確定。両方のヒントで OR 検証）
    const dom = document.body.textContent ?? "";
    const hasIso = dom.includes("2026-04-26T12:00") || dom.includes("2026-04-26 12:00");
    const hasJp =
      dom.includes("2026年4月26日") ||
      dom.includes("2026/04/26") ||
      dom.includes("2026/4/26") ||
      dom.includes("12:00");
    expect(hasIso || hasJp).toBe(true);
  });

  it("30 分以上経過時、表示色がグレー化される", () => {
    const oldDate = new Date(Date.now() - 31 * 60 * 1000);
    const { container } = render(
      <ShojiStatusWidget
        variant="full"
        status="available"
        summary="少し前の更新"
        updatedAt={oldDate}
      />,
    );

    // data-stale="true" 属性をルートまたはどこかに含む
    const staleEl = container.querySelector('[data-stale="true"]');
    expect(staleEl).not.toBeNull();

    // グレー化: 'gray' / 'stale' / 'muted' のいずれかを含む class を期待（実装側で吸収）
    const classNames = staleEl?.getAttribute("class") ?? "";
    const hasGrayHint =
      /gray|stale|muted|opacity/i.test(classNames) ||
      (staleEl as HTMLElement | null)?.style?.opacity !== "";
    expect(hasGrayHint).toBe(true);
  });
});
