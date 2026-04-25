/**
 * T-F7-01: 共通 InfoTooltip のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f7-01-info-tooltip.md §10
 *
 * 観点:
 *   - 初期状態は閉（tooltip 非表示）
 *   - hover / focus で開き、leave / blur / Esc で閉じる
 *   - a11y: role="tooltip", aria-describedby, aria-expanded, aria-label
 *   - title / children の描画
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { InfoTooltip } from "@/app/forest/_components/InfoTooltip";

describe("InfoTooltip - initial state", () => {
  beforeEach(() => cleanup());

  it("renders the i button with default aria-label", () => {
    render(<InfoTooltip>content</InfoTooltip>);
    expect(
      screen.getByRole("button", { name: "詳細情報" }),
    ).toBeInTheDocument();
  });

  it("uses custom aria-label when `label` prop is provided", () => {
    render(<InfoTooltip label="使い方のヘルプ">content</InfoTooltip>);
    expect(
      screen.getByRole("button", { name: "使い方のヘルプ" }),
    ).toBeInTheDocument();
  });

  it("does NOT render tooltip content initially", () => {
    render(<InfoTooltip>hidden body</InfoTooltip>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.queryByText("hidden body")).not.toBeInTheDocument();
  });

  it("sets aria-expanded=false initially", () => {
    render(<InfoTooltip>content</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("InfoTooltip - hover trigger", () => {
  beforeEach(() => cleanup());

  it("opens tooltip when the wrapper receives mouseEnter", () => {
    render(<InfoTooltip>hover body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });
    const wrapper = button.parentElement!;

    fireEvent.mouseEnter(wrapper);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("hover body")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes tooltip when the wrapper receives mouseLeave", () => {
    render(<InfoTooltip>hover body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });
    const wrapper = button.parentElement!;

    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does NOT open on mouseEnter when trigger='focus'", () => {
    render(<InfoTooltip trigger="focus">body</InfoTooltip>);
    const wrapper = screen.getByRole("button").parentElement!;

    fireEvent.mouseEnter(wrapper);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("InfoTooltip - focus trigger (keyboard)", () => {
  beforeEach(() => cleanup());

  it("opens tooltip when button receives focus", () => {
    render(<InfoTooltip>focused body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    fireEvent.focus(button);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("focused body")).toBeInTheDocument();
  });

  it("closes tooltip when button receives blur", () => {
    render(<InfoTooltip>focused body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    fireEvent.focus(button);
    fireEvent.blur(button);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does NOT open on focus when trigger='hover'", () => {
    render(<InfoTooltip trigger="hover">body</InfoTooltip>);
    const button = screen.getByRole("button");

    fireEvent.focus(button);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("InfoTooltip - keyboard escape", () => {
  beforeEach(() => cleanup());

  it("closes tooltip when Escape key is pressed", () => {
    render(<InfoTooltip>body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does nothing on other keys", () => {
    render(<InfoTooltip>body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    fireEvent.focus(button);
    fireEvent.keyDown(document, { key: "Enter" });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});

describe("InfoTooltip - content rendering", () => {
  beforeEach(() => cleanup());

  it("renders title and children when open", () => {
    render(
      <InfoTooltip title="使い方">
        <span>step 1</span>
        <span>step 2</span>
      </InfoTooltip>,
    );
    const button = screen.getByRole("button");
    fireEvent.focus(button);

    expect(screen.getByText("使い方")).toBeInTheDocument();
    expect(screen.getByText("step 1")).toBeInTheDocument();
    expect(screen.getByText("step 2")).toBeInTheDocument();
  });

  it("wires aria-describedby from button to tooltip when open", () => {
    render(<InfoTooltip>body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    fireEvent.focus(button);

    const tooltip = screen.getByRole("tooltip");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(tooltip).toHaveAttribute("id", describedBy!);
  });

  it("omits aria-describedby when tooltip is closed", () => {
    render(<InfoTooltip>body</InfoTooltip>);
    const button = screen.getByRole("button", { name: "詳細情報" });

    expect(button).not.toHaveAttribute("aria-describedby");
  });
});
