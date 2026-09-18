import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import HikariBasicsDocument from "./HikariBasicsDocument";
import { hikariChapters, hikariFigures, type HikariFigure } from "../_data/hikari-basics";

const figures: HikariFigure[] = hikariFigures.map(figure => ({ ...figure, src: `https://example.com/${figure.id}.webp` }));

describe("光回線・通信の基礎", () => {
  it("7章の見出しを番号つきで表示する", () => {
    render(<HikariBasicsDocument figures={figures} />);
    hikariChapters.forEach(chapter => {
      const heading = screen.getByRole("heading", { name: `${chapter.number}${chapter.title}`, level: 2 });
      expect(heading.closest("section")).toHaveAttribute("id", chapter.id);
    });
  });

  it("目次のリンクが7本で章idと一致する", () => {
    render(<HikariBasicsDocument figures={figures} />);
    const toc = within(screen.getByRole("navigation", { name: "光回線・通信の基礎の目次" }));
    const links = toc.getAllByRole("link");
    expect(links).toHaveLength(7);
    hikariChapters.forEach((chapter, index) => {
      expect(links[index]).toHaveAttribute("href", `#${chapter.id}`);
      expect(links[index]).toHaveTextContent(`${chapter.number}${chapter.tocTitle}`);
    });
  });

  it("原稿の要所を本文に表示する", () => {
    const { container } = render(<HikariBasicsDocument figures={figures} />);
    expect(container.textContent).toContain("道路");
    expect(container.textContent).toContain("料金所");
    expect(container.textContent).toContain("8日以内");
    expect(container.textContent).toContain("事業者変更");
    expect(container.textContent).toContain("アナログ戻し");
    expect(container.querySelectorAll("strong").length).toBeGreaterThan(0);
    expect(screen.getByText("8日以内")).toBeInTheDocument();
  });

  it("figuresを8件渡すとimgが8つ出てaltがある", () => {
    const { container } = render(<HikariBasicsDocument figures={figures} />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(8);
    figures.forEach(figure => {
      expect(screen.getByRole("img", { name: figure.alt })).toHaveAttribute("src", figure.src);
    });
  });

  it("figuresが空ならimgは出さず本文は表示する", () => {
    const { container } = render(<HikariBasicsDocument figures={[]} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).toContain("インターネットを利用するには");
    expect(container.textContent).toContain("通信速度の単位と読み方");
  });
});
