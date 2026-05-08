import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShojiStatusCloud } from "../ShojiStatusCloud";
import { ShojiStatusContext, type CeoStatus } from "../../ShojiStatusContext";

function withCtx(ui: React.ReactNode, status: CeoStatus | null = null) {
  return (
    <ShojiStatusContext.Provider value={{ status, loading: false, error: null, refresh: async () => {} }}>
      {ui}
    </ShojiStatusContext.Provider>
  );
}

describe("ShojiStatusCloud", () => {
  it("wraps with cloud-shaped (asymmetric border-radius) floating card", () => {
    const { container } = render(withCtx(<ShojiStatusCloud />));
    const cloud = container.firstChild as HTMLElement;
    const style = cloud?.getAttribute("style") ?? "";
    expect(style).toMatch(/position:\s*absolute/);
    expect(style).toMatch(/top:\s*24px/);
    expect(style).toMatch(/right:\s*24px/);
    // asymmetric border-radius (px values + slash separator for elliptical)
    expect(style).toMatch(/border-radius:.*\//);
  });
  it("renders inner ShojiStatusWidget compact (skeleton when status null)", () => {
    render(withCtx(<ShojiStatusCloud />));
    expect(screen.getByTestId("ceo-status-skeleton")).toBeInTheDocument();
  });
});
