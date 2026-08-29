import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import ShachoShell from "./ShachoShell";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }) }));

const manager = { name: "責任者A", company: "株式会社A", role: "manager" as const };

describe("ShachoShell", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("shows the Garden modules in the shared order followed by System", () => {
    render(<ShachoShell activePath="/system" user={manager}><p>本文</p></ShachoShell>);
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    const labels = within(rail).getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(labels).toHaveLength(13);
    expect(labels.map((label) => label?.split("：")[0])).toEqual([...GARDEN_SHELL_MODULES.map((item) => item.name), "System"]);
  });

  it("toggles and saves the root theme", async () => {
    render(<ShachoShell activePath="/system" user={manager}><p>本文</p></ShachoShell>);
    const button = await screen.findByRole("button", { name: "ダークにする" });
    fireEvent.click(button);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("garden-system-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "ライトにする" })).toBeInTheDocument();
  });

  it("shows the signed-in account name beside the shared actions", () => {
    render(<ShachoShell activePath="/system" user={manager}><p>本文</p></ShachoShell>);
    expect(screen.getByText("責任者Aさん")).toBeInTheDocument();
    expect(screen.getByText("責任者Aさん").parentElement).toContainElement(screen.getByRole("button", { name:"ダークにする" }));
  });

  it("restores a saved theme", async () => {
    localStorage.setItem("garden-system-theme", "dark");
    render(<ShachoShell activePath="/system" user={manager}><p>本文</p></ShachoShell>);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(await screen.findByRole("button", { name: "ライトにする" })).toBeInTheDocument();
  });

  it("uses the OS dark theme only when no preference is saved", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<ShachoShell activePath="/system" user={manager}><p>本文</p></ShachoShell>);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(localStorage.getItem("garden-system-theme")).toBeNull();
  });

  it("hides contract management below manager", () => {
    render(<ShachoShell activePath="/system" user={{ ...manager, role: "staff" }}><p>本文</p></ShachoShell>);
    expect(screen.queryByRole("link", { name: "契約書管理" })).not.toBeInTheDocument();
  });

  it("marks mypage as the current System menu item", () => {
    render(<ShachoShell activePath="/system/mypage" user={manager}><p>本文</p></ShachoShell>);
    expect(screen.getByRole("link", { name: "マイページ", current: "page" })).toBeInTheDocument();
  });

  it("marks call metrics as the current System menu item", () => {
    render(<ShachoShell activePath="/system/call-metrics" user={manager}><p>本文</p></ShachoShell>);
    expect(screen.getByRole("link", { name: "テレマ コール集計", current: "page" })).toBeInTheDocument();
  });

  it("marks contracts as the current System menu item", () => {
    render(<ShachoShell activePath="/system/contracts" user={manager}><p>本文</p></ShachoShell>);
    expect(screen.getByRole("link", { name: "契約書管理", current: "page" })).toBeInTheDocument();
  });

  it("filters the rail with the shared staff visibility matrix", () => {
    render(<ShachoShell activePath="/system" user={{ ...manager, role: "staff" }}><p>本文</p></ShachoShell>);
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    expect(within(rail).queryByRole("link", { name: /^Soil：/ })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("link", { name: /^Rill：/ })).not.toBeInTheDocument();
    expect(within(rail).getByRole("link", { name: "System：社内システム" })).toBeInTheDocument();
  });

  it("keeps all twelve modules for super admins", () => {
    render(<ShachoShell activePath="/system" user={{ ...manager, role: "super_admin" }}><p>本文</p></ShachoShell>);
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    expect(within(rail).getAllByRole("link")).toHaveLength(13);
  });
});
