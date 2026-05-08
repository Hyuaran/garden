import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Sidebar — role-gated nav", () => {
  it("renders all 7 nav items for super_admin", () => {
    render(<Sidebar role="super_admin" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    expect(nav).toBeInTheDocument();
    // 7 items: ホーム / ダッシュボード / 取引 / 顧客 / ワークフロー / レポート / 設定
    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(7);
  });

  it("renders 6 nav items for admin (no settings)", () => {
    // settings minRole = admin; admin should see all 7
    render(<Sidebar role="admin" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(7);
  });

  it("renders 6 items for manager (no settings)", () => {
    render(<Sidebar role="manager" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    // settings minRole = admin (rank 6); manager (rank 5) blocked → 6 items
    expect(links.length).toBe(6);
  });

  it("renders 5 items for staff (no settings + no レポート)", () => {
    render(<Sidebar role="staff" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    // staff = rank 4; レポート minRole = manager (rank 5) → blocked
    // Visible: ホーム / ダッシュボード / 取引 / 顧客 / ワークフロー = 5
    expect(links.length).toBe(5);
  });

  it("renders 2 items for cs (ホーム + 顧客)", () => {
    render(<Sidebar role="cs" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    // cs = rank 3; visible: ホーム (outsource ≤) + 顧客 (cs) = 2
    expect(links.length).toBe(2);
  });

  it("renders 1 item for outsource (ホームのみ)", () => {
    render(<Sidebar role="outsource" />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    // outsource = rank 0; only ホーム minRole=outsource visible
    expect(links.length).toBe(1);
    expect(screen.getByText("ホーム")).toBeInTheDocument();
  });

  it("includes HelpCard at bottom", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("help-card")).toBeInTheDocument();
  });

  it("default role is super_admin (all 7 items)", () => {
    render(<Sidebar />);
    const nav = screen.getByLabelText("業務ドメインナビゲーション");
    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(7);
  });
});
