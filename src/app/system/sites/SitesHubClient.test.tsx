import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import SitesHubClient from "./SitesHubClient";
import { CORPORATE_SITES_DATA } from "./_lib/sites-registry";

describe("SitesHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the grouped list view by default", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByText("コーポレートサイト")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "コーポレートサイト" })).toBeInTheDocument();
    expect(screen.getByText("更新日：2026/09/24")).toBeInTheDocument();
    expect(screen.getByText("稼働 4")).toBeInTheDocument();
    expect(screen.getByText("移管待ち 4")).toBeInTheDocument();
    expect(screen.getByText("新規作成待ち 5")).toBeInTheDocument();
    expect(screen.getByTestId("sites-list-view")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9);
    expect(screen.getAllByText("ドメイン未定")).toHaveLength(2);
  });

  it("renders live site URLs as links opening a new tab", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const link = screen.getByRole("link", { name: "hyuaran.com ↗" });
    expect(link).toHaveAttribute("href", "https://hyuaran.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows seven excluded items at the bottom", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const excluded = screen.getByRole("region", { name: "対象外・解約" });
    expect(within(excluded).getAllByRole("listitem")).toHaveLength(7);
  });

  it("switches to card view and saves the setting", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    fireEvent.click(screen.getByRole("button", { name: "カード表示にする" }));

    expect(screen.getByTestId("sites-grid-view")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "会社HP" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "商品ページ SMART BREAKER" })).toBeInTheDocument();
    expect(localStorage.getItem("garden.sites.viewMode")).toBe("grid");
  });

  it("restores the saved card view and can switch back to list", () => {
    localStorage.setItem("garden.sites.viewMode", "grid");
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    expect(screen.getByTestId("sites-grid-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "一覧表示にする" }));
    expect(screen.getByTestId("sites-list-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.sites.viewMode")).toBe("list");
  });
});
