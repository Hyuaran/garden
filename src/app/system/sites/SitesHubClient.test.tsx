import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import SitesHubClient from "./SitesHubClient";
import { CORPORATE_SITES_DATA } from "./_lib/sites-registry";

describe("SitesHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the grid view by default with company headings and site cards", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByText("コーポレートサイト")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "コーポレートサイト" })).toBeInTheDocument();
    expect(screen.getByText("サイトの一覧（稼働 10／移管待ち 3／新規作成待ち 0）")).toBeInTheDocument();
    expect(screen.getByText("更新日 2026/09/25")).toBeInTheDocument();

    expect(screen.getByTestId("sites-grid-view")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(8);
    expect(screen.getAllByTestId("site-card")).toHaveLength(13);
  });

  it("renders live site cards with open links and keeps pending or unpublished cards closed", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const liveLinks = screen.getAllByRole("link", { name: "開く" });
    expect(liveLinks).toHaveLength(10);
    expect(liveLinks[0]).toHaveAttribute("href", "https://hyuaran.com/");
    liveLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    // 移管待ち（denshibreaker.com）は URL が無く「未公開」。ARATA光は URL があっても移管待ちなので［開く］は出ない
    const pendingCard = screen.getAllByTestId("site-card").find((card) =>
      within(card).queryByText("denshibreaker.com"),
    );
    expect(pendingCard).toBeDefined();
    expect(within(pendingCard!).getByText("未公開")).toBeInTheDocument();
    expect(screen.queryByText("ドメイン未定")).not.toBeInTheDocument();
    expect(screen.getByText("GitHub Hyuaran/hyuaran")).toBeInTheDocument();
    // 種別チップ：会社HP と 商品ページ を区別。壱は 会社HP＋商品 で注記（highlight）が出る
    expect(screen.getAllByText("会社HP", { selector: "span" }).length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText("商品ページ", { selector: "span" }).length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("会社HP＋商品")).toBeInTheDocument();
    expect(screen.getByText("Ichi光は URL 不変で Vercel 化（https://ichi-one.com/ 他 5 ページ）")).toBeInTheDocument();
  });

  it("switches to list view with a six-column table and ten open links", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    fireEvent.click(screen.getByRole("button", { name: "リスト表示にする" }));

    const listView = screen.getByTestId("sites-list-view");
    expect(within(listView).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(listView).getAllByRole("row")).toHaveLength(14);
    expect(within(listView).getAllByRole("link", { name: "開く" })).toHaveLength(10);
    expect(localStorage.getItem("garden.sites.viewMode")).toBe("list");
  });

  it("restores the saved list view and can switch back to grid", () => {
    localStorage.setItem("garden.sites.viewMode", "list");
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    expect(screen.getByTestId("sites-list-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "グリッド表示にする" }));
    expect(screen.getByTestId("sites-grid-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.sites.viewMode")).toBe("grid");
  });

  it("shows seven excluded items at the bottom", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} />);

    const excluded = screen.getByRole("region", { name: "対象外・解約" });
    expect(within(excluded).getAllByRole("listitem")).toHaveLength(7);
  });
});
