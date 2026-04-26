import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GardenView } from "../GardenView";
import { ShojiStatusContext, type CeoStatus } from "../../ShojiStatusContext";

function withCtx(ui: React.ReactNode, status: CeoStatus | null = null) {
  return (
    <ShojiStatusContext.Provider value={{ status, loading: false, error: null, refresh: async () => {} }}>
      {ui}
    </ShojiStatusContext.Provider>
  );
}

describe("GardenView", () => {
  it("renders 3 layers (background aria-hidden + module nav + status cloud area)", () => {
    const { container } = render(withCtx(<GardenView />));
    // BackgroundLayer: aria-hidden div with absolute positioning
    const bg = container.querySelector('div[aria-hidden][style*="z-index: 0"], div[aria-hidden][style*="zIndex"]');
    expect(bg).not.toBeNull();
    // ModuleLayer: aria-label="Garden 12 モジュール"
    const moduleLayer = container.querySelector('[aria-label="Garden 12 モジュール"]');
    expect(moduleLayer).not.toBeNull();
    // ShojiStatusCloud: contains the widget skeleton (status null → renders skeleton)
    const skeleton = container.querySelector('[data-testid="ceo-status-skeleton"]');
    expect(skeleton).not.toBeNull();
  });
  it("outer container uses aspect-ratio 4/3 + overflow hidden", () => {
    const { container } = render(withCtx(<GardenView />));
    const outer = container.firstChild as HTMLElement;
    const style = outer?.getAttribute("style") ?? "";
    expect(style).toMatch(/aspect-ratio:\s*4\s*\/\s*3/);
    expect(style).toMatch(/overflow:\s*hidden/);
  });
});
