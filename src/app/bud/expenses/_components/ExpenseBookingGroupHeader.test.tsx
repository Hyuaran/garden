import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpenseBookingGroupHeader } from "./ExpenseBookingGroupHeader";

describe("ExpenseBookingGroupHeader", () => {
  it("keeps employee count and total visible while collapsed", () => {
    renderHeader({ collapsed: true });
    expect(screen.getByText("石原 孝志朗")).toBeInTheDocument();
    expect(screen.getByText("5件")).toBeInTheDocument();
    expect(screen.getByText("合計 ¥8,700")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an indeterminate group checkbox and sends selection changes", () => {
    const onToggleSelection = vi.fn();
    renderHeader({ partial: true, onToggleSelection });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    expect(screen.getByText("一部選択")).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(onToggleSelection).toHaveBeenCalledWith(true);
  });
});

function renderHeader(overrides: Partial<React.ComponentProps<typeof ExpenseBookingGroupHeader>>) {
  const props: React.ComponentProps<typeof ExpenseBookingGroupHeader> = {
    applicantName: "石原 孝志朗",
    count: 5,
    totalAmount: 8700,
    collapsed: false,
    checked: false,
    partial: false,
    disabled: false,
    onToggleCollapsed: vi.fn(),
    onToggleSelection: vi.fn(),
    ...overrides,
  };
  return render(<table><tbody><ExpenseBookingGroupHeader {...props} /></tbody></table>);
}
