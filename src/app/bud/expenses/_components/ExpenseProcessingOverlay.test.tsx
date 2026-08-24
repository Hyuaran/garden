import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseProcessingOverlay } from "./ExpenseProcessingOverlay";

describe("ExpenseProcessingOverlay", () => {
  it("covers the screen with count, action and warning while open", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { rerender } = render(<ExpenseProcessingOverlay open count={257} action="完了に" progress={{ done: 10, total: 257 }} />, { container: host });
    const overlay = screen.getByRole("status");
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay).toHaveStyle({ position: "fixed", inset: "0", pointerEvents: "all" });
    expect(screen.getByText("257件を完了にしています…")).toBeInTheDocument();
    expect(screen.getByText("257件中 10件")).toBeInTheDocument();
    expect(screen.getByText("この画面を閉じないでください")).toBeInTheDocument();
    rerender(<ExpenseProcessingOverlay open={false} count={257} action="完了に" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("joins export actions into natural Japanese", () => {
    render(<ExpenseProcessingOverlay open count={4392} action="台帳形式Excelで書き出" />);
    expect(screen.getByText("4,392件を台帳形式Excelで書き出しています…")).toBeInTheDocument();
  });
});
