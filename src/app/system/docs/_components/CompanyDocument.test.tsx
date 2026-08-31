import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import CompanyDocument, { MemberCard } from "./CompanyDocument";
import MemberPhoto from "./MemberPhoto";
import { members, visibleMembers, type Member } from "../_data/members";
import { chapters, getEmployeeCountLabel, groupCompanies } from "../_data/company-doc";

function member(id: string) { return members.find(member => member.id === id)!; }

describe("会社説明", () => {
  it("非表示の2名をHTML・写真URL・カードに含めない", () => {
    const html = renderToStaticMarkup(<CompanyDocument members={members} photos={{ "tsuji-mayuko": "https://example.com/retired.webp" }} />);
    for (const id of ["matsumoto-minari", "tsuji-mayuko"]) {
      expect(html).not.toContain(member(id).name);
      expect(html).not.toContain(id);
    }
    expect(html).not.toContain("retired.webp");
    const { container } = render(<CompanyDocument members={members} />);
    expect(container.querySelectorAll("[data-member-id]")).toHaveLength(12);
  });

  it.each(["photo", "department", "hobbies", "joinedLabel", "title"] as const)("hidden:%s は値があっても出力しない", field => {
    const person: Member = { ...member("ueda-moto"), department: "非公開所属の値", hidden: [field] };
    const { container } = render(<MemberCard member={person} photo="https://example.com/hidden.webp" />);
    if (field === "photo") {
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByRole("img", { name: /イニシャル/ })).toHaveTextContent("上");
    } else {
      expect(container.querySelector(`[data-field="${field}"]`)).toBeNull();
      expect(container.textContent).not.toContain(person[field]);
      if (field === "title") expect(container.textContent).not.toContain(person.alsoRepresents);
    }
  });

  it.each([
    ["kan-taiei", "2025年入社", "総務部（バックヤード）", "ゲーム、アニメ"],
    ["ishihara-koshiro", "2026年入社", "営業部", "サッカー観戦"],
    ["kotani-iori", "2026年入社", "営業部／総務部（バックヤード）", "散歩"],
    ["kirii-daisuke", "2025年入社", "訪問営業部", null],
  ])("%sは確認済みの項目だけを出す", (id, joined, department, hobby) => {
    render(<MemberCard member={member(id!)} />);
    expect(screen.getByRole("heading", { name: member(id!).name })).toBeInTheDocument();
    expect(screen.getByText(joined!)).toBeInTheDocument();
    expect(screen.getByText(department!)).toBeInTheDocument();
    if (hobby) expect(screen.getByText(hobby)).toBeInTheDocument();
    else expect(screen.queryByText("趣味")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(未設定|-)$/)).not.toBeInTheDocument();
  });

  it("空文字の項目はhidden指定がなくても行を出さない", () => {
    const { container } = render(<MemberCard member={{ ...member("kirii-daisuke"), department: "", hidden: [] }} />);
    expect(container.querySelector('[data-field="department"]')).toBeNull();
    expect(container.querySelector('[data-field="hobbies"]')).toBeNull();
  });

  it("全6章を順番に表示し、目次の全リンクに飛び先がある", () => {
    const { container } = render(<CompanyDocument members={members} />);
    const toc = within(screen.getByRole("navigation", { name: "会社説明の目次" }));
    expect(toc.getAllByRole("link")).toHaveLength(6);
    chapters.forEach(chapter => {
      const heading = screen.getByRole("heading", { name: `${chapter.number}${chapter.title}`, level: 2 });
      expect(heading.closest("section")).toHaveAttribute("id", chapter.id);
      expect(toc.getByRole("link", { name: `${chapter.number}${chapter.title}` })).toHaveAttribute("href", `#${chapter.id}`);
    });
    expect([...container.querySelectorAll("section[id]")].map(section => section.id)).toEqual(chapters.map(chapter => chapter.id));
  });

  it("共に働く仲間の先頭を代表の後道　翔太にし、別枠の代表紹介は置かない", () => {
    render(<CompanyDocument members={[...members].reverse()} />);
    const team = screen.getByRole("region", { name: "6共に働く仲間" });
    expect(within(team).getByRole("heading", { name: "後道　翔太" })).toBeInTheDocument();
    expect(team.querySelector("[data-member-id]")).toHaveAttribute("data-member-id", "goto-shota");
    expect(visibleMembers()[0].id).toBe("goto-shota");
    expect(screen.queryByRole("region", { name: "我々の代表紹介" })).not.toBeInTheDocument();
  });

  it("会社概要の更新値、グループ7社と責任者を表示し、アルバイトの個人名は出さない", () => {
    const { container } = render(<CompanyDocument members={members} />);
    expect(screen.getAllByText(/サンマリオンタワー/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2016年4月8日")).toBeInTheDocument();
    expect(getEmployeeCountLabel()).toBe("約40名（2026年9月1日 現在）");
    expect(screen.getByText(getEmployeeCountLabel())).toBeInTheDocument();
    expect(container.querySelectorAll("[data-group-company]")).toHaveLength(7);
    groupCompanies.forEach(company => expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument());
    expect(container.textContent).not.toContain("BYアルバイト");
    expect(container.textContent).not.toContain("川中");
  });

  it("沿革と専門用語の補足を表示する", () => {
    const { container } = render(<CompanyDocument members={members} />);
    expect(container.textContent).toContain("健康経営優良法人認定／本社をサンマリオンタワーへ移転");
    expect(container.textContent).toContain("自社コンテンツサービスの提供開始（Ichi光）／労働者派遣事業の開始");
    expect([...container.querySelectorAll("ol li strong")].map(year => year.textContent))
      .toEqual(["2016年", "2018年", "2019年", "2020年", "2021年", "2022年", "2023年", "2024年", "2025年", "2026年"]);
    expect(container.textContent).toContain("CRM事業（電話やメールでお客様と関係を作る仕事）");
    expect(container.textContent).toContain("toC（個人のお客様向け）");
    expect(container.textContent).toContain("toB（会社向け）");
    expect(container.textContent).toContain("OEM（他社の名前で商品を作ること）");
  });
});

describe("写真のフォールバック", () => {
  it("写真をクリックすると拡大表示し、閉じるボタンで閉じる", () => {
    render(<MemberPhoto name="後道　翔太" src="https://example.com/goto.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "後道　翔太の写真を拡大表示" }));
    const dialog = screen.getByRole("dialog", { name: "後道　翔太の写真を拡大表示" });
    expect(within(dialog).getByRole("img", { name: "後道　翔太の写真" })).toHaveAttribute("src", "https://example.com/goto.webp");
    expect(within(dialog).getByText(/後道\s翔太/)).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(within(dialog).getByRole("button", { name: "拡大写真を閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("幕のクリックとEscキーで拡大表示を閉じる", () => {
    render(<MemberPhoto name="上田　基人" src="https://example.com/ueda.webp" />);
    const openButton = screen.getByRole("button", { name: "上田　基人の写真を拡大表示" });
    fireEvent.click(openButton);
    fireEvent.click(screen.getByRole("dialog", { name: "上田　基人の写真を拡大表示" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(openButton);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("写真が無い人は拡大表示を開くボタンを出さない", () => {
    render(<MemberPhoto name="簡　棣榮" />);
    expect(screen.getByRole("img", { name: "簡　棣榮のイニシャル" })).toHaveTextContent("簡");
    expect(screen.queryByRole("button", { name: /写真を拡大表示/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("写真を出さない設定の人は丸のイニシャル", () => {
    const noPhoto: Member = { ...member("ueda-moto"), hidden: ["photo"] };
    const { container } = render(<MemberCard member={noPhoto} photo="https://example.com/unused.webp" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /イニシャル/ })).toHaveTextContent("上");
  });
  it("署名URLが取得できなければイニシャル", () => {
    render(<MemberPhoto name="東海林　美琴" />);
    expect(screen.getByRole("img", { name: /イニシャル/ })).toHaveTextContent("東");
  });
  it("画像の読み込みエラー後は壊れたimgを取り除く", () => {
    const { container } = render(<MemberPhoto name="後道　翔太" src="https://example.com/unavailable.webp" />);
    fireEvent.error(screen.getByRole("img", { name: "後道　翔太の写真" }));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "後道　翔太のイニシャル" })).toHaveTextContent("後");
  });
});
