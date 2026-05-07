import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleGrid } from "../ModuleGrid";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("ModuleGrid", () => {
  it("renders 12 cards in CLAUDE.md 1-12 + 3-layer order", () => {
    render(<ModuleGrid />);
    const grid = screen.getByTestId("module-grid");
    expect(grid).toBeInTheDocument();
    const cards = grid.querySelectorAll('[data-module-key]');
    expect(cards.length).toBe(12);
  });

  it("Row 1 (樹冠) has bloom/fruit/seed/forest in order", () => {
    render(<ModuleGrid />);
    const grid = screen.getByTestId("module-grid");
    const cards = Array.from(grid.querySelectorAll('[data-module-key]'));
    // first 4 should be 樹冠
    expect(cards[0].getAttribute("data-module-key")).toBe("bloom");
    expect(cards[1].getAttribute("data-module-key")).toBe("fruit");
    expect(cards[2].getAttribute("data-module-key")).toBe("seed");
    expect(cards[3].getAttribute("data-module-key")).toBe("forest");
  });

  it("Row 2 (地上) has bud/leaf/tree/sprout in order", () => {
    render(<ModuleGrid />);
    const grid = screen.getByTestId("module-grid");
    const cards = Array.from(grid.querySelectorAll('[data-module-key]'));
    expect(cards[4].getAttribute("data-module-key")).toBe("bud");
    expect(cards[5].getAttribute("data-module-key")).toBe("leaf");
    expect(cards[6].getAttribute("data-module-key")).toBe("tree");
    expect(cards[7].getAttribute("data-module-key")).toBe("sprout");
  });

  it("Row 3 (地下) has soil/root/rill/calendar in order", () => {
    render(<ModuleGrid />);
    const grid = screen.getByTestId("module-grid");
    const cards = Array.from(grid.querySelectorAll('[data-module-key]'));
    expect(cards[8].getAttribute("data-module-key")).toBe("soil");
    expect(cards[9].getAttribute("data-module-key")).toBe("root");
    expect(cards[10].getAttribute("data-module-key")).toBe("rill");
    expect(cards[11].getAttribute("data-module-key")).toBe("calendar");
  });

  it("enabled modules render Link with href", () => {
    render(<ModuleGrid />);
    // bloom is enabled → Link
    const bloomCard = screen.getByTestId("module-card-bloom");
    expect(bloomCard.tagName).toBe("A");
    expect(bloomCard.getAttribute("href")).toBe("/bloom/workboard");
  });

  it("disabled modules render div with aria-disabled", () => {
    render(<ModuleGrid />);
    // soil is disabled → div
    const soilCard = screen.getByTestId("module-card-soil");
    expect(soilCard.tagName).toBe("DIV");
    expect(soilCard.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders mock badge for bud (未処理仕訳: 12件)", () => {
    render(<ModuleGrid />);
    expect(screen.getByText("未処理仕訳: 12件")).toBeInTheDocument();
  });

  it("renders mock badge for tree (架電予定: 15件)", () => {
    render(<ModuleGrid />);
    expect(screen.getByText("架電予定: 15件")).toBeInTheDocument();
  });

  it("does NOT render badge for modules without mock data (e.g., calendar)", () => {
    render(<ModuleGrid />);
    const calendar = screen.getByTestId("module-card-calendar");
    expect(calendar.textContent).not.toMatch(/件$/);
  });

  it("each card has English label + Japanese description", () => {
    render(<ModuleGrid />);
    expect(screen.getByText("Bloom")).toBeInTheDocument();
    expect(screen.getByText("案件一覧・KPI")).toBeInTheDocument();
    expect(screen.getByText("Soil")).toBeInTheDocument();
    expect(screen.getByText(/DB 本体/)).toBeInTheDocument();
  });
});
