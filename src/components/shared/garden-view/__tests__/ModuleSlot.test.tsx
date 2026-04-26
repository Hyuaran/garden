import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleSlot } from "../ModuleSlot";
import type { ModuleDef } from "../_lib/modules";

const enabledModule: ModuleDef = {
  emoji: "🌳", label: "Forest", href: "/forest", color: "#1F5C3A", enabled: true,
};
const disabledModule: ModuleDef = {
  emoji: "🌱", label: "Soil", href: "/soil", color: "#8B6F47", enabled: false,
};
const pos = { left: "50%", top: "50%" };

describe("ModuleSlot enabled", () => {
  it("renders a Link to module.href", () => {
    render(<ModuleSlot module={enabledModule} position={pos} />);
    const link = screen.getByRole("link", { name: /Forest/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forest");
  });
  it("renders emoji and label both", () => {
    render(<ModuleSlot module={enabledModule} position={pos} />);
    expect(screen.getByText("🌳")).toBeInTheDocument();
    expect(screen.getByText("Forest")).toBeInTheDocument();
  });
});

describe("ModuleSlot disabled", () => {
  it("does NOT render as Link (no role=link)", () => {
    render(<ModuleSlot module={disabledModule} position={pos} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("renders with aria-disabled and 準備中 title", () => {
    const { container } = render(<ModuleSlot module={disabledModule} position={pos} />);
    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("title")).toBe("準備中");
  });
});
