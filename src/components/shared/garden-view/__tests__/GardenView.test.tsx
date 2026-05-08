import { describe, it, expect, vi, beforeEach } from "vitest";
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

// matchMedia mock for BackgroundCarousel's prefers-reduced-motion check
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("GardenView", () => {
  it("renders 4 layers (background carousel + bonsai + module nav + status cloud)", () => {
    const { container } = render(withCtx(<GardenView />));
    // BackgroundCarousel: data-testid + aria-hidden
    const bg = container.querySelector('[data-testid="background-carousel"]');
    expect(bg).not.toBeNull();
    // BonsaiCenter: aria-hidden, 円形 wrapper
    const bonsai = container.querySelector('div[aria-hidden][style*="border-radius: 50%"], div[aria-hidden][style*="borderRadius"]');
    expect(bonsai).not.toBeNull();
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
  it("forwards initialAtmosphere to BackgroundCarousel", () => {
    const { container } = render(withCtx(<GardenView initialAtmosphere={3} />));
    const carousel = container.querySelector('[data-testid="background-carousel"]');
    expect(carousel?.getAttribute("data-atmosphere-index")).toBe("3");
  });
  it("forwards initialMode to BackgroundCarousel", () => {
    const { container } = render(withCtx(<GardenView initialMode="auto" />));
    const carousel = container.querySelector('[data-testid="background-carousel"]');
    expect(carousel?.getAttribute("data-atmosphere-mode")).toBe("auto");
  });
});
