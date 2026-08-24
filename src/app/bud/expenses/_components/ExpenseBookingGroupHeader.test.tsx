import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpenseBookingGroupHeader } from "./ExpenseBookingGroupHeader";

describe("ExpenseBookingGroupHeader", () => {
  it("keeps employee count and total visible while collapsed", () => {
    const { container } = renderHeader({ collapsed: true, selectedCount: 0, selectedAmount: 0 });
    expect(screen.getByText("石原 孝志朗")).toBeInTheDocument();
    expect(screen.getByText("選択 0件 ¥0（¥0）")).toBeInTheDocument();
    expect(screen.getByText("全5件 ¥8,700（¥7,909）")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("td > div")).toHaveStyle({ flexWrap: "wrap", whiteSpace: "normal" });
  });

  it("shows selected count and amount with an indeterminate checkbox", () => {
    const onToggleSelection = vi.fn();
    renderHeader({ partial: true, selectedCount: 2, selectedAmount: 13740, totalAmount: 205043, onToggleSelection });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    expect(screen.getByText("選択 2件 ¥13,740（¥12,490）")).toBeInTheDocument();
    expect(screen.getByText("全5件 ¥205,043（¥186,402）")).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(onToggleSelection).toHaveBeenCalledWith(true);
  });

  it("shows the warning only when the group contains invalid rows", () => {
    const { rerender } = renderHeader({ invalidCount: 2 });
    expect(screen.getByText("要確認 2件")).toBeInTheDocument();
    const props = makeProps({ invalidCount: 0 });
    rerender(<table><tbody><ExpenseBookingGroupHeader {...props} /></tbody></table>);
    expect(screen.queryByText(/要確認/)).not.toBeInTheDocument();
  });

  it("updates the tax-excluded amount when the selected amount changes", () => {
    const { rerender } = renderHeader({ selectedCount: 2, selectedAmount: 13740 });
    expect(screen.getByText("選択 2件 ¥13,740（¥12,490）")).toBeInTheDocument();
    const props = makeProps({ selectedCount: 0, selectedAmount: 0 });
    rerender(<table><tbody><ExpenseBookingGroupHeader {...props} /></tbody></table>);
    expect(screen.getByText("選択 0件 ¥0（¥0）")).toBeInTheDocument();
  });

  it("allows long selected and total amounts to wrap instead of overflowing", () => {
    renderHeader({ selectedAmount: 123456789, totalAmount: 987654321 });
    expect(screen.getByText(/選択 0件/)).toHaveStyle({ overflowWrap: "anywhere" });
    expect(screen.getByText(/全5件/)).toHaveStyle({ overflowWrap: "anywhere" });
  });
});

function renderHeader(overrides: Partial<React.ComponentProps<typeof ExpenseBookingGroupHeader>>) {
  const props = makeProps(overrides);
  return render(<table><tbody><ExpenseBookingGroupHeader {...props} /></tbody></table>);
}

function makeProps(overrides: Partial<React.ComponentProps<typeof ExpenseBookingGroupHeader>>) {
  return {
    applicantName: "石原 孝志朗",
    count: 5,
    totalAmount: 8700,
    selectedCount: 0,
    selectedAmount: 0,
    invalidCount: 0,
    collapsed: false,
    checked: false,
    partial: false,
    disabled: false,
    onToggleCollapsed: vi.fn(),
    onToggleSelection: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof ExpenseBookingGroupHeader>;
}
