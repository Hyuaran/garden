/**
 * T-F4-02 / TaxPill のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §5 Step 3
 *
 * ・kind と isPaid から背景色を決める分岐
 * ・amount が null のときは金額部を非表示
 * ・onClick 渡されないときは disabled
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TaxPill } from "@/app/forest/_components/TaxPill";

describe("TaxPill", () => {
  it("renders the label text", () => {
    render(<TaxPill kind="kakutei" label="確定" amount={null} isPaid={false} />);
    expect(screen.getByText("確定")).toBeInTheDocument();
  });

  it("renders the formatted amount when provided", () => {
    render(
      <TaxPill kind="yotei" label="予定" amount={2_324_000} isPaid={false} />,
    );
    // fmtYen: 1万以上 1億未満 → 232万
    expect(screen.getByText("232万")).toBeInTheDocument();
  });

  it("does not render an amount node when amount is null", () => {
    render(<TaxPill kind="yotei" label="予定" amount={null} isPaid={false} />);
    expect(screen.queryByText("―")).not.toBeInTheDocument();
  });

  it("invokes onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <TaxPill
        kind="kakutei"
        label="確定"
        amount={1000}
        isPaid={false}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when onClick is not provided", () => {
    render(<TaxPill kind="kakutei" label="確定" amount={null} isPaid={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("includes 納付済 in aria-label when isPaid=true", () => {
    render(
      <TaxPill
        kind="kakutei"
        label="確定"
        amount={null}
        isPaid={true}
      />,
    );
    expect(
      screen.getByRole("button", { name: /納付済/ }),
    ).toBeInTheDocument();
  });

  it("does not include 納付済 in aria-label when isPaid=false", () => {
    render(
      <TaxPill
        kind="kakutei"
        label="確定"
        amount={null}
        isPaid={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /納付済/ }),
    ).not.toBeInTheDocument();
  });

  // jsdom は hex を rgb に正規化するため、両形式を許容するヘルパで比較。
  function hexToRgbRegex(hex: string): RegExp {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return new RegExp(
      `${hex}|rgb\\(\\s*${r},\\s*${g},\\s*${b}\\s*\\)`,
      "i",
    );
  }

  it("paid variant uses green background regardless of kind", () => {
    const { container } = render(
      <TaxPill kind="kakutei" label="確定" amount={null} isPaid={true} />,
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("style")).toMatch(hexToRgbRegex("#a3b18a"));
  });

  it("kakutei variant uses red-ish background when not paid", () => {
    const { container } = render(
      <TaxPill kind="kakutei" label="確定" amount={null} isPaid={false} />,
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("style")).toMatch(hexToRgbRegex("#e07a7a"));
  });

  it("yotei variant uses yellow background when not paid", () => {
    const { container } = render(
      <TaxPill kind="yotei" label="予定" amount={null} isPaid={false} />,
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("style")).toMatch(hexToRgbRegex("#c9a84c"));
  });

  it("extra variant uses the same yellow as yotei", () => {
    const { container } = render(
      <TaxPill
        kind="extra"
        label="予定（消費税）"
        amount={null}
        isPaid={false}
      />,
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("style")).toMatch(hexToRgbRegex("#c9a84c"));
  });
});
