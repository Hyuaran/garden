import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ loadSlideDecks: vi.fn(), loadSlideDeck: vi.fn(), notFound: vi.fn(), requireDocsUser: vi.fn() }));
vi.mock("../_lib/slides.server", () => ({ loadSlideDecks: mocks.loadSlideDecks, loadSlideDeck: mocks.loadSlideDeck }));
vi.mock("../_lib/company-doc.server", () => ({ requireDocsUser: mocks.requireDocsUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import DocsPage from "../page";
import SlidesPage from "./page";
import SlideDeckPage from "./[deck]/page";
import SlideOrientationPage from "@/app/(orientation)/system/docs/slides/[deck]/present/page";
import SlideOrientationLayout from "@/app/(orientation)/system/docs/slides/[deck]/present/layout";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";

const decks = [
  { id: "01-orientation", category: "入社したら", title: "アルバイト入社オリエンテーション", description: "入社時に必要な説明事項をまとめています。", slideCount: 14, visible: true, order: 1, coverUrl: "https://example.com/01.webp" },
  { id: "03-refresh-time", category: "入社したら", title: "リフレッシュタイム", description: "休憩時間（リフレッシュタイム）の取り方やルールの説明です。", slideCount: 10, visible: true, order: 2, coverUrl: "https://example.com/03.webp" },
  { id: "04-sales-guide", category: "入社したら", title: "営業導入ガイド", description: "営業の仕事を始めるにあたっての流れとポイントをまとめています。", slideCount: 10, visible: true, order: 3, coverUrl: "https://example.com/04.webp" },
];
const fullDeck = { ...decks[0], slides: Array.from({ length: 14 }, (_, index) => ({ index: index + 1, src: `https://example.com/s_${index + 1}.webp` })) };

describe("スライド画面", () => {
  it("資料一覧にスライドのカードを出す", async () => {
    render(await DocsPage());
    expect(screen.getByRole("link", { name: /スライド/ })).toHaveAttribute("href", "/system/docs/slides");
    expect(screen.getByText("スライドを見る →")).toBeInTheDocument();
  });

  it("一覧に3本の表紙・題名・全何枚を出す", async () => {
    mocks.loadSlideDecks.mockResolvedValue(decks);
    const { container } = render(await SlidesPage());
    expect(within(screen.getByRole("region", { name: "入社したら" })).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /アルバイト入社オリエンテーション/ })).toHaveAttribute("href", "/system/docs/slides/01-orientation");
    expect(screen.getByText("全14枚")).toBeInTheDocument();
    expect(screen.getAllByRole("img").map(image => image.getAttribute("src"))).toEqual(decks.map(deck => deck.coverUrl));
    expect(container.textContent).not.toMatch(/\b(deck|slide|signed URL)\b/i);
  });

  it("1本を開くと枚数ぶんの画像と投影入口を出す", async () => {
    mocks.loadSlideDeck.mockResolvedValue(fullDeck);
    render(await SlideDeckPage({ params: Promise.resolve({ deck: "01-orientation" }) }));
    expect(mocks.loadSlideDeck).toHaveBeenCalledWith("01-orientation");
    expect(screen.getByRole("heading", { name: "アルバイト入社オリエンテーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "オリエンテーション表示" })).toHaveAttribute("href", "/system/docs/slides/01-orientation/present");
    expect(screen.getAllByRole("img")).toHaveLength(14);
    expect(screen.getByText("14 / 14")).toBeInTheDocument();
  });

  it("未登録のidは404にする", async () => {
    mocks.notFound.mockImplementation(() => { throw new Error("notFound"); });
    mocks.loadSlideDeck.mockResolvedValue(undefined);
    await expect(SlideDeckPage({ params: Promise.resolve({ deck: "missing" }) })).rejects.toThrow("notFound");
  });

  it("オリエンテーション表示は通常メニューを出さず、資料に戻るを現在の資料に向ける", async () => {
    mocks.loadSlideDeck.mockResolvedValue(fullDeck);
    const page = await SlideOrientationPage({ params: Promise.resolve({ deck: "01-orientation" }) });
    const layout = await SlideOrientationLayout({ children: page, params: Promise.resolve({ deck: "01-orientation" }) });
    render(<ThemeProvider>{layout}</ThemeProvider>);
    expect(mocks.loadSlideDeck).toHaveBeenCalledWith("01-orientation", "/system/docs/slides/01-orientation/present");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Systemメニュー" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ダークにする|ライトにする/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "資料に戻る" })).toHaveAttribute("href", "/system/docs/slides/01-orientation");
    expect(screen.getAllByRole("img")).toHaveLength(14);
  });
});
