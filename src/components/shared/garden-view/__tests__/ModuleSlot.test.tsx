import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleSlot } from "../ModuleSlot";
import { MODULE_KEYS, MODULES, type ModuleDef } from "../_lib/modules";

const enabledModule: ModuleDef = {
  emoji: "🌳", label: "Forest", href: "/forest", color: "#1F5C3A", enabled: true, layer: "樹冠",
};
const disabledModule: ModuleDef = {
  emoji: "🌱", label: "Soil", href: "/soil", color: "#8B6F47", enabled: false, layer: "地下",
};
const pos = { x: 0, y: 0 };  // 中央基準（cross-ui-06 §3.4）

describe("ModuleSlot enabled", () => {
  it("renders a Link to module.href", () => {
    render(<ModuleSlot moduleKey="forest" module={enabledModule} position={pos} />);
    const link = screen.getByRole("link", { name: /Forest/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forest");
  });
  it("renders module icon img + label", () => {
    const { container } = render(<ModuleSlot moduleKey="forest" module={enabledModule} position={pos} />);
    const img = container.querySelector('img[src="/themes/module-icons/forest.webp"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Forest")).toBeInTheDocument();
  });
});

describe("ModuleSlot disabled", () => {
  it("does NOT render as Link (no role=link)", () => {
    render(<ModuleSlot moduleKey="soil" module={disabledModule} position={pos} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("renders with aria-disabled and layer-aware 準備中 title", () => {
    const { container } = render(<ModuleSlot moduleKey="soil" module={disabledModule} position={pos} />);
    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).not.toBeNull();
    // title 例: 「Soil（地下） — 準備中」
    expect(wrapper?.getAttribute("title")).toMatch(/Soil.*地下.*準備中/);
    expect(wrapper?.getAttribute("aria-label")).toMatch(/Soil.*地下.*準備中/);
  });
});

describe("ModuleSlot hover-effect wiring", () => {
  it("attaches gv-slot class + data-module-key on enabled inner div", () => {
    const { container } = render(<ModuleSlot moduleKey="forest" module={enabledModule} position={pos} />);
    const inner = container.querySelector("a > .gv-slot");
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute("data-module-key")).toBe("forest");
  });
  it("attaches gv-slot class + data-module-key on disabled inner div", () => {
    const { container } = render(<ModuleSlot moduleKey="soil" module={disabledModule} position={pos} />);
    const inner = container.querySelector('[aria-disabled="true"] > .gv-slot');
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute("data-module-key")).toBe("soil");
  });
});

describe("ModuleSlot transparent icon mapping", () => {
  it.each(MODULE_KEYS)("renders /themes/module-icons/%s.webp", (key) => {
    const def = MODULES[key];
    const { container } = render(<ModuleSlot moduleKey={key} module={def} position={pos} />);
    const img = container.querySelector(`img[src="/themes/module-icons/${key}.webp"]`);
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ModuleSlot icon × hover effect compatibility", () => {
  it.each(MODULE_KEYS)("keeps gv-slot class + data-module-key on %s slot", (key) => {
    const def = MODULES[key];
    const { container } = render(<ModuleSlot moduleKey={key} module={def} position={pos} />);
    // gv-slot div should contain the img
    const slot = container.querySelector(`.gv-slot[data-module-key="${key}"]`);
    expect(slot).not.toBeNull();
    expect(slot?.querySelector("img")).not.toBeNull();
  });
});

describe("ModuleSlot — bilingual label (Phase 2-2 候補 8)", () => {
  it("renders both English label and Japanese description for enabled module", () => {
    const def: ModuleDef = {
      emoji: "🌳",
      label: "Forest",
      description: "全法人決算",
      href: "/forest",
      color: "#1F5C3A",
      enabled: true,
      layer: "樹冠",
    };
    render(<ModuleSlot moduleKey="forest" module={def} position={pos} />);
    expect(screen.getByText("Forest")).toBeInTheDocument();
    expect(screen.getByText("全法人決算")).toBeInTheDocument();
  });
  it("renders both labels for disabled module", () => {
    const def: ModuleDef = {
      emoji: "🌱",
      label: "Soil",
      description: "DB 本体・大量データ基盤",
      href: "/soil",
      color: "#8B6F47",
      enabled: false,
      layer: "地下",
    };
    render(<ModuleSlot moduleKey="soil" module={def} position={pos} />);
    expect(screen.getByText("Soil")).toBeInTheDocument();
    expect(screen.getByText(/DB 本体/)).toBeInTheDocument();
  });
});
