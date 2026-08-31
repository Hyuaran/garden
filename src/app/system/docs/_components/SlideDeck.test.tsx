import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SlideDeck from "./SlideDeck";
import type { PlayableSlideDeck } from "../_data/slides";

const deck: PlayableSlideDeck = {
  id: "01-orientation",
  category: "入社したら",
  title: "アルバイト入社オリエンテーション",
  description: "入社時に必要な説明事項をまとめています。",
  slideCount: 3,
  visible: true,
  order: 1,
  slides: [
    { index: 1, src: "https://example.com/s_01.webp" },
    { index: 2, src: "https://example.com/s_02.webp" },
    { index: 3, src: "https://example.com/s_03.webp" },
  ],
};

describe("スライド本文", () => {
  it("画像を縦に並べ、枚数表示と非公開画像向け属性を付ける", () => {
    const { container } = render(<SlideDeck deck={deck} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(3);
    images.forEach(image => {
      expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
      expect(image).not.toHaveAttribute("loading");
    });
  });

  it("左右キーで次と前の画像へ送る", () => {
    const { container } = render(<SlideDeck deck={deck} />);
    const figures = [...container.querySelectorAll("figure")];
    const scrolls = figures.map(figure => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(figure, "scrollIntoView", { configurable: true, value: scrollIntoView });
      return scrollIntoView;
    });
    const rects = figures.map(figure => vi.spyOn(figure, "getBoundingClientRect"));
    rects.forEach((rect, index) => rect.mockReturnValue({ top: index === 1 ? 4 : 400, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(scrolls[2]).toHaveBeenCalledTimes(1);
    rects.forEach((rect, index) => rect.mockReturnValue({ top: index === 1 ? 4 : 400, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(scrolls[0]).toHaveBeenCalledTimes(1);
  });

  it("画像が1枚もないときは再読込案内を出す", () => {
    render(<SlideDeck deck={{ ...deck, slides: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("ページを再読み込みしてお試しください");
  });
});
