import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleSlot } from "../ModuleSlot";
import type { ModuleDef } from "../_lib/modules";

const enabledModule: ModuleDef = {
  emoji: "🌳", label: "Forest", href: "/forest", color: "#1F5C3A", enabled: true, layer: "樹冠",
};
const disabledModule: ModuleDef = {
  emoji: "🌱", label: "Soil", href: "/soil", color: "#8B6F47", enabled: false, layer: "地下",
};
const pos = { x: 0, y: 0 };  // 中央基準（cross-ui-06 §3.4）

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
  it("renders with aria-disabled and layer-aware 準備中 title", () => {
    const { container } = render(<ModuleSlot module={disabledModule} position={pos} />);
    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).not.toBeNull();
    // title 例: 「Soil（地下） — 準備中」
    expect(wrapper?.getAttribute("title")).toMatch(/Soil.*地下.*準備中/);
    expect(wrapper?.getAttribute("aria-label")).toMatch(/Soil.*地下.*準備中/);
  });
});
