import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BackgroundCarousel } from "../BackgroundCarousel";
import { ATMOSPHERES, ATMOSPHERE_COUNT, AUTO_INTERVAL_MS } from "../_lib/atmospheres";

// matchMedia mock for prefers-reduced-motion check
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

afterEach(() => {
  vi.useRealTimers();
});

describe("BackgroundCarousel — initial state", () => {
  it("starts at index 0 by default", () => {
    render(<BackgroundCarousel />);
    const container = screen.getByTestId("background-carousel");
    expect(container.getAttribute("data-atmosphere-index")).toBe("0");
  });

  it("starts at given initialIndex", () => {
    render(<BackgroundCarousel initialIndex={3} />);
    const container = screen.getByTestId("background-carousel");
    expect(container.getAttribute("data-atmosphere-index")).toBe("3");
  });

  it("starts in manual mode by default", () => {
    render(<BackgroundCarousel />);
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-mode")).toBe("manual");
  });

  it("starts in auto mode when initialMode='auto'", () => {
    render(<BackgroundCarousel initialMode="auto" />);
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-mode")).toBe("auto");
  });
});

describe("BackgroundCarousel — auto mode cycling", () => {
  it("auto-advances every AUTO_INTERVAL_MS in auto mode", () => {
    vi.useFakeTimers();
    render(<BackgroundCarousel initialMode="auto" />);
    const container = screen.getByTestId("background-carousel");
    expect(container.getAttribute("data-atmosphere-index")).toBe("0");

    act(() => {
      vi.advanceTimersByTime(AUTO_INTERVAL_MS);
    });
    expect(container.getAttribute("data-atmosphere-index")).toBe("1");

    act(() => {
      vi.advanceTimersByTime(AUTO_INTERVAL_MS);
    });
    expect(container.getAttribute("data-atmosphere-index")).toBe("2");
  });

  it("wraps around at the end in auto mode", () => {
    vi.useFakeTimers();
    render(<BackgroundCarousel initialIndex={5} initialMode="auto" />);
    const container = screen.getByTestId("background-carousel");
    act(() => {
      vi.advanceTimersByTime(AUTO_INTERVAL_MS);
    });
    expect(container.getAttribute("data-atmosphere-index")).toBe("0");
  });

  it("does NOT auto-advance in manual mode", () => {
    vi.useFakeTimers();
    render(<BackgroundCarousel initialMode="manual" />);
    const container = screen.getByTestId("background-carousel");
    act(() => {
      vi.advanceTimersByTime(AUTO_INTERVAL_MS * 2);
    });
    expect(container.getAttribute("data-atmosphere-index")).toBe("0");
  });

  it("respects prefers-reduced-motion (no auto advance even in auto mode)", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true, // reduced motion
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.useFakeTimers();
    render(<BackgroundCarousel initialMode="auto" />);
    const container = screen.getByTestId("background-carousel");
    act(() => {
      vi.advanceTimersByTime(AUTO_INTERVAL_MS * 3);
    });
    expect(container.getAttribute("data-atmosphere-index")).toBe("0");
  });
});

describe("BackgroundCarousel — keyboard shortcuts", () => {
  it("ArrowRight advances by 1", () => {
    render(<BackgroundCarousel />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("1");
  });

  it("ArrowLeft retreats by 1 (wraps to last)", () => {
    render(<BackgroundCarousel />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe(String(ATMOSPHERE_COUNT - 1));
  });

  it("Space advances by 1 (same as ArrowRight)", () => {
    render(<BackgroundCarousel />);
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("1");
  });

  it("'1' to '6' jump directly to that atmosphere", () => {
    render(<BackgroundCarousel />);
    fireEvent.keyDown(window, { key: "4" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("3");
    fireEvent.keyDown(window, { key: "1" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("0");
    fireEvent.keyDown(window, { key: "6" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("5");
  });

  it("'A' / 'a' toggles mode between manual and auto", () => {
    render(<BackgroundCarousel />);
    const container = screen.getByTestId("background-carousel");
    expect(container.getAttribute("data-atmosphere-mode")).toBe("manual");
    fireEvent.keyDown(window, { key: "A" });
    expect(container.getAttribute("data-atmosphere-mode")).toBe("auto");
    fireEvent.keyDown(window, { key: "a" });
    expect(container.getAttribute("data-atmosphere-mode")).toBe("manual");
  });

  it("does NOT respond to keystrokes inside INPUT", () => {
    render(
      <>
        <input data-testid="input" />
        <BackgroundCarousel />
      </>,
    );
    const input = screen.getByTestId("input");
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(screen.getByTestId("background-carousel").getAttribute("data-atmosphere-index")).toBe("0");
  });

  it("ignores '7'..'9' (out of range)", () => {
    render(<BackgroundCarousel initialIndex={2} />);
    const container = screen.getByTestId("background-carousel");
    fireEvent.keyDown(window, { key: "7" });
    expect(container.getAttribute("data-atmosphere-index")).toBe("2");
  });
});

describe("BackgroundCarousel — rendering all atmospheres", () => {
  it("renders all 6 atmosphere layers (only current is opacity 1)", () => {
    const { container } = render(<BackgroundCarousel initialIndex={2} />);
    const atmospheres = container.querySelectorAll("[data-atmosphere-key]");
    expect(atmospheres).toHaveLength(ATMOSPHERE_COUNT);
    atmospheres.forEach((el, i) => {
      const opacity = (el as HTMLElement).style.opacity;
      expect(opacity).toBe(i === 2 ? "1" : "0");
    });
  });
});
