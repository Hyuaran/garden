import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseKindBadge } from "./ExpenseKindBadge";

describe("ExpenseKindBadge", () => {
  it("shows only company expenses", () => {
    const { rerender } = render(<ExpenseKindBadge kind="company" />);
    expect(screen.getByText("会社経費")).toBeInTheDocument();
    rerender(<ExpenseKindBadge kind="individual" />);
    expect(screen.queryByText("会社経費")).not.toBeInTheDocument();
  });
});
