import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OrbGrid from "../OrbGrid";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

let stageRect = { width: 900, height: 640 };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

beforeEach(() => {
  mocks.push.mockReset();
  stageRect = { width: 900, height: 640 };
  vi.useFakeTimers();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains("home-orbit-stage")) {
      return {
        x: 0,
        y: 0,
        width: stageRect.width,
        height: stageRect.height,
        top: 0,
        right: stageRect.width,
        bottom: stageRect.height,
        left: 0,
        toJSON: () => ({}),
      };
    }
    return {
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      top: 0,
      right: 120,
      bottom: 120,
      left: 0,
      toJSON: () => ({}),
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("OrbitStage", () => {
  it("renders only role-visible modules in the orbit", () => {
    render(<OrbGrid visibleModules={["Bloom", "Tree", "Leaf", "Calendar"]} />);

    expect(screen.getByLabelText("Garden modules orbit")).toHaveAttribute(
      "data-visible-count",
      "4",
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Bloom/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Forest/ })).not.toBeInTheDocument();
  });

  it("shows the center panel on hover and navigates from the panel button", () => {
    render(<OrbGrid visibleModules={["Bloom", "Tree"]} />);

    fireEvent.mouseEnter(screen.getByRole("link", { name: /Bloom/ }));

    expect(screen.getByText("案件一覧、日報、KPI、経営ダッシュボードを扱う中核モジュール。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));

    expect(mocks.push).toHaveBeenCalledWith("/bloom/workboard");
  });

  it("delays direct link navigation so the sparkle can play", () => {
    render(<OrbGrid visibleModules={["Tree"]} />);

    fireEvent.click(screen.getByRole("link", { name: /Tree/ }));

    expect(mocks.push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(mocks.push).toHaveBeenCalledWith("/tree");
  });

  it("keeps twelve mobile bubbles from overlapping at 390px width", () => {
    stageRect = { width: 390, height: 844 };
    render(<OrbGrid />);

    const bubbles = screen.getAllByRole("link");
    const positions = bubbles.map((bubble) => {
      const style = bubble.getAttribute("style") ?? "";
      const sizeMatch = style.match(/--orbit-bubble-size:\s*([\d.]+)px/);
      const transformMatch = style.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
      return {
        size: Number(sizeMatch?.[1] ?? 0),
        x: Number(transformMatch?.[1] ?? 0),
        y: Number(transformMatch?.[2] ?? 0),
      };
    });

    const minDistance = positions.reduce((min, current, index) => {
      const next = positions[(index + 1) % positions.length];
      const distance = Math.hypot(current.x - next.x, current.y - next.y);
      return Math.min(min, distance);
    }, Number.POSITIVE_INFINITY);

    expect(minDistance).toBeGreaterThanOrEqual(positions[0].size);
  });
});
