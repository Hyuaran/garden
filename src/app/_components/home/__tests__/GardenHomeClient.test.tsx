import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../_lib/auth-unified", () => ({ signOutUnified: vi.fn() }));

import GardenHomeClient from "../GardenHomeClient";
import { ThemeProvider } from "../../../_lib/theme/ThemeProvider";

const ALL_VISIBLE = [
  "Bloom", "Fruit", "Seed", "Forest", "Bud", "Leaf",
  "Tree", "Sprout", "Soil", "Root", "Rill", "Calendar",
];

function renderHome(visibleModules: readonly string[] = ALL_VISIBLE) {
  return render(
    <ThemeProvider>
      <GardenHomeClient employeeName="東海林 美琴" visibleModules={visibleModules} />
    </ThemeProvider>,
  );
}

describe("Garden series card home", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
  });

  it("renders the fixed 13-card order from System through Calendar", async () => {
    renderHome();
    await screen.findByText(/東海林 美琴さん、/);
    const cards = within(screen.getByTestId("module-grid")).getAllByRole("link");
    expect(cards).toHaveLength(13);
    expect(cards.map((card) => card.textContent)).toEqual([
      "社内システムSystemマイページや勤怠打刻など。",
      "案件KPIBloom案件の進みぐあいと数字。",
      "法人実態情報Fruit取引先の法人がどんな会社かを調べます。",
      "新事業Seedこれから始める事業の検討。",
      "全法人決算Forest7つの法人の決算をまとめて。",
      "経理・収支Bud経費精算・入金・振込・給与・仕訳。",
      "個別アプリLeaf関西電力など、案件ごとの専用画面。",
      "架電Tree架電の受付から結果の記録まで。",
      "採用Sprout求人と応募者のやりとり。",
      "データ基盤SoilGarden全体のデータの土台。",
      "組織マスタRoot従業員名簿と法人の情報。",
      "メッセージRillメールの確認・送信・取り込み。",
      "予定管理Calendar会議や来客の予定を共有。",
    ]);
  });

  it("adds and removes a favorite without changing the module cards or navigating", async () => {
    renderHome();
    expect(await screen.findByText(/まだお気に入りはありません/)).toBeInTheDocument();
    const pathname = window.location.pathname;

    fireEvent.click(screen.getByRole("button", { name: "社内システムをお気に入りに追加" }));
    const favoriteGrid = screen.getByTestId("favorite-grid");
    expect(within(favoriteGrid).getAllByRole("link")).toHaveLength(1);
    expect(within(screen.getByTestId("module-grid")).getAllByRole("link")).toHaveLength(13);
    expect(window.location.pathname).toBe(pathname);
    expect(window.localStorage.getItem("garden.home.favorites")).toBe('["system"]');

    fireEvent.click(within(favoriteGrid).getByRole("button", { name: "社内システムをお気に入りから外す" }));
    expect(await screen.findByText(/まだお気に入りはありません/)).toBeInTheDocument();
    expect(window.localStorage.getItem("garden.home.favorites")).toBe("[]");
  });

  it("restores favorites from localStorage while preserving the canonical order", async () => {
    window.localStorage.setItem("garden.home.favorites", '["bud","system"]');
    renderHome();

    await waitFor(() => expect(screen.getByTestId("favorite-grid")).toBeInTheDocument());
    expect(within(screen.getByTestId("favorite-grid")).getAllByRole("link").map((card) => card.textContent)).toEqual([
      "社内システムSystem",
      "経理・収支Bud",
    ]);
  });

  it("filters both module cards and saved favorites with visibleModules", async () => {
    window.localStorage.setItem("garden.home.favorites", '["forest","bud"]');
    renderHome(["Bloom", "Bud"]);

    await waitFor(() => expect(screen.getByTestId("favorite-grid")).toBeInTheDocument());
    expect(within(screen.getByTestId("module-grid")).getAllByRole("link").map((card) => card.textContent)).toEqual([
      "社内システムSystemマイページや勤怠打刻など。",
      "案件KPIBloom案件の進みぐあいと数字。",
      "経理・収支Bud経費精算・入金・振込・給与・仕訳。",
    ]);
    expect(within(screen.getByTestId("favorite-grid")).getAllByRole("link").map((card) => card.textContent)).toEqual([
      "経理・収支Bud",
    ]);
  });
});
