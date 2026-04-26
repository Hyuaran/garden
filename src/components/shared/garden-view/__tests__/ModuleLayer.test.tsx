import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleLayer } from "../ModuleLayer";
import { MODULE_KEYS } from "../_lib/modules";

describe("ModuleLayer", () => {
  it("renders all 12 module slots", () => {
    const { container } = render(<ModuleLayer />);
    // count slot wrappers (each has either role=link or aria-disabled)
    const linksCount = container.querySelectorAll("a").length;
    const disabledCount = container.querySelectorAll('[aria-disabled="true"]').length;
    expect(linksCount + disabledCount).toBe(MODULE_KEYS.length);
    expect(MODULE_KEYS.length).toBe(12);
  });
  it("uses absolute positioning for each slot via inline style", () => {
    const { container } = render(<ModuleLayer />);
    // Each slot wrapper has position: absolute via inline style
    // Pick the Forest one (enabled, has href)
    const forestLink = screen.getByRole("link", { name: /Forest/ });
    const wrapper = forestLink as HTMLAnchorElement;
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toMatch(/position:\s*absolute/);
    expect(style).toMatch(/left:\s*8%/);
    expect(style).toMatch(/top:\s*78%/);
  });
});
