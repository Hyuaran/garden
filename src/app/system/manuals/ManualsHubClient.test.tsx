import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ManualsHubClient from "./ManualsHubClient";
import { getManualModules, getVisibleManuals, getVisibleManualDocs } from "./_lib/manuals-registry";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { renderMarkdown } from "./_lib/render-markdown";
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ refresh: vi.fn() }) }));
const modules = getManualModules("staff");
const manuals = getVisibleManuals("staff").map(manual => ({ ...manual, visibleDocs: getVisibleManualDocs(manual, "staff") }));
const conceptHtml = renderMarkdown(readFileSync("src/app/system/manuals/_content/garden-concept.md", "utf8"));
describe("ManualsHubClient", () => {
  it("defaults to the concept with headings and tables", () => {
    render(<ManualsHubClient modules={modules} manuals={manuals} conceptHtml={conceptHtml} />);
    expect(screen.getByRole("tab", { name: "Garden とは" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Garden とは" })).toBeInTheDocument();
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "System" })).toHaveAttribute("href", "/system/manuals?tab=system");
  });
  it("changes the list for each tab URL", () => {
    const { rerender } = render(<ManualsHubClient modules={modules} manuals={manuals} conceptHtml={conceptHtml} selectedTab="system" />);
    expect(screen.getByRole("cell", { name: "入社手続き" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "経費精算" })).not.toBeInTheDocument();
    rerender(<ManualsHubClient modules={modules} manuals={manuals} conceptHtml={conceptHtml} selectedTab="bud" />);
    expect(screen.getByRole("cell", { name: "経費精算" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "入社手続き" })).not.toBeInTheDocument();
  });
  it("hides inaccessible modules and falls back from an invalid tab", () => {
    render(<ManualsHubClient modules={modules.slice(0,1)} conceptHtml={conceptHtml} selectedTab="bud" />);
    expect(screen.queryByRole("tab", { name: "Bud" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Garden とは" })).toHaveAttribute("aria-selected", "true");
  });
});

it("keeps the manual hub gear in the tabs row", () => {
  render(<SystemViewProvider value={{ pageKey: "system-manuals", admin: true, canAdd: false, tabs: [] }}><ManualsHubClient modules={modules} conceptHtml={conceptHtml} /></SystemViewProvider>);
  const gear = screen.getByRole("button", { name: "見られる人の設定" });
  expect(screen.getByRole("heading", { name: "マニュアル" })).not.toContainElement(gear);
  expect(screen.getByRole("tablist").parentElement).toContainElement(gear);
});

it("shows every module in shell order and disables modules without manuals", () => {
  render(<ManualsHubClient modules={modules} conceptHtml={conceptHtml} selectedTab="soil" />);
  expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Garden とは", "System", ...GARDEN_SHELL_MODULES.map(module => module.name)]);
  for (const module of GARDEN_SHELL_MODULES.filter(module => module.id !== "bud" && module.id !== "root")) {
    const tab = screen.getByRole("tab", { name: module.name });
    expect(tab).toBeDisabled();
    expect(tab).toHaveAttribute("title", "まだマニュアルがありません");
    expect(tab).not.toHaveAttribute("href");
  }
  expect(screen.getByRole("tab", { name: "Garden とは" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "共通" })).not.toBeInTheDocument();
});
