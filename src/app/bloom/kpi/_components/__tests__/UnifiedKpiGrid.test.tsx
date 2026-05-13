import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedKpiGrid } from "../UnifiedKpiGrid";

describe("UnifiedKpiGrid", () => {
  it("4 つの KPI カード (Forest 実データ + Tree/Bud/Leaf placeholder) を render する", () => {
    render(<UnifiedKpiGrid />);
    // Forest カード (loading or ready のいずれか必ず存在)
    const forestCard =
      screen.queryByTestId("kpi-forest-ready") ?? screen.queryByTestId("kpi-forest-loading");
    expect(forestCard).not.toBeNull();
    // Placeholder カード 3 件
    expect(screen.getByTestId("kpi-placeholder-tree")).toBeTruthy();
    expect(screen.getByTestId("kpi-placeholder-bud")).toBeTruthy();
    expect(screen.getByTestId("kpi-placeholder-leaf")).toBeTruthy();
  });
});
