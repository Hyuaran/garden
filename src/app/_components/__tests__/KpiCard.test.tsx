import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../KpiCard";
import { KPI_CARDS, getVisibleKpiCards } from "../../_lib/kpi-fetchers";

describe("KpiCard", () => {
  it("renders title / value / delta / icon", () => {
    const card = KPI_CARDS[0]; // sales
    render(<KpiCard card={card} />);
    expect(screen.getByText(card.title)).toBeInTheDocument();
    expect(screen.getByText(card.value)).toBeInTheDocument();
    expect(screen.getByText(card.delta)).toBeInTheDocument();
    expect(screen.getByText(card.icon)).toBeInTheDocument();
  });

  it("includes mock notice text", () => {
    render(<KpiCard card={KPI_CARDS[0]} />);
    expect(screen.getByText(/モック値・5\/5 後に実データ連携/)).toBeInTheDocument();
  });

  it("has data-testid based on card id", () => {
    const card = KPI_CARDS[3]; // tasks
    render(<KpiCard card={card} />);
    expect(screen.getByTestId(`kpi-card-${card.id}`)).toBeInTheDocument();
  });

  it("trend up shows ▲ glyph", () => {
    const upCard = KPI_CARDS.find((c) => c.trend === "up")!;
    render(<KpiCard card={upCard} />);
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("trend down shows ▼ glyph", () => {
    const downCard = KPI_CARDS.find((c) => c.trend === "down")!;
    render(<KpiCard card={downCard} />);
    expect(screen.getByText("▼")).toBeInTheDocument();
  });
});

describe("getVisibleKpiCards", () => {
  it("returns all 4 for super_admin", () => {
    expect(getVisibleKpiCards("super_admin").length).toBe(4);
  });
  it("returns all 4 for admin", () => {
    expect(getVisibleKpiCards("admin").length).toBe(4);
  });
  it("returns all 4 for manager", () => {
    expect(getVisibleKpiCards("manager").length).toBe(4);
  });
  it("returns 2 for staff (calls + tasks)", () => {
    const cards = getVisibleKpiCards("staff");
    expect(cards.length).toBe(2);
    expect(cards.map((c) => c.id).sort()).toEqual(["calls", "tasks"]);
  });
  it("returns 2 for cs (calls + tasks)", () => {
    expect(getVisibleKpiCards("cs").length).toBe(2);
  });
  it("returns 2 for closer (calls + tasks)", () => {
    expect(getVisibleKpiCards("closer").length).toBe(2);
  });
  it("returns 1 for toss (tasks only)", () => {
    expect(getVisibleKpiCards("toss").length).toBe(1);
  });
  it("returns 1 for outsource (tasks only)", () => {
    expect(getVisibleKpiCards("outsource").length).toBe(1);
  });
});
