import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpCard } from "../HelpCard";

describe("HelpCard", () => {
  it("renders ヘルプ heading + description + button", () => {
    render(<HelpCard />);
    expect(screen.getByRole("heading", { level: 3, name: /ヘルプ/ })).toBeInTheDocument();
    expect(screen.getByText(/Garden の使い方/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "ヘルプを開く" });
    expect(link).toHaveAttribute("href", "/help");
  });
  it("has data-testid for layout selectors", () => {
    const { container } = render(<HelpCard />);
    expect(container.querySelector('[data-testid="help-card"]')).not.toBeNull();
  });
});
