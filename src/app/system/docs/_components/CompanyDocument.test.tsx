import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import CompanyDocument, { MemberCard } from "./CompanyDocument";
import MemberPhoto from "./MemberPhoto";
import { members, type Member } from "../_data/members";
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
    ["kan-taiei", "2025年入社", "ゲーム、アニメ"],
    ["ishihara-koshiro", "2026年入社", "サッカー観戦"],
    ["kotani-iori", "2026年入社", "散歩"],
    ["kirii-daisuke", "2025年入社", null],
  ])("%sは確認済みの項目だけを出す", (id, joined, hobby) => {
    render(<MemberCard member={member(id!)} />);
    expect(screen.getByRole("heading", { name: member(id!).name })).toBeInTheDocument();
    expect(screen.getByText(joined!)).toBeInTheDocument();
    expect(screen.queryByText("所属")).not.toBeInTheDocument();
    if (hobby) expect(screen.getByText(hobby)).toBeInTheDocument();
    else expect(screen.queryByText("趣味")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(未設定|-)$/)).not.toBeInTheDocument();
  });

  it("空文字の項目はhidden指定がなくても行を出さない", () => {
    const { container } = render(<MemberCard member={{ ...member("kirii-daisuke"), hidden: [] }} />);
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

  it("代表を仲間一覧から分離し最後のセクションにする", () => {
    const { container } = render(<CompanyDocument members={[...members].reverse()} />);
    const sections = container.querySelectorAll("section");
    expect(sections[sections.length - 1]).toHaveAccessibleName("我々の代表紹介");
    expect(within(sections[sections.length - 1] as HTMLElement).getByRole("heading", { name: "後道　翔太" })).toBeInTheDocument();
    const team = screen.getByRole("region", { name: "6共に働く仲間" });
    expect(within(team).queryByRole("heading", { name: "後道　翔太" })).not.toBeInTheDocument();
    expect(team.querySelector("[data-member-id]")).toHaveAttribute("data-member-id", "ueda-moto");
  });

  it("会社概要の更新値、グループ7社と責任者を表示し、アルバイトの個人名は出さない", () => {
    const { container } = render(<CompanyDocument members={members} />);
    expect(screen.getByText(/サンマリオンタワー/)).toBeInTheDocument();
    expect(screen.getByText("2016年4月8日")).toBeInTheDocument();
    expect(getEmployeeCountLabel()).toBe("約40名（2026年9月1日 現在）");
    expect(screen.getByText(getEmployeeCountLabel())).toBeInTheDocument();
    expect(container.querySelectorAll("[data-group-company]")).toHaveLength(7);
    groupCompanies.forEach(company => expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument());
    expect(screen.getByText("BYアルバイト")).toBeInTheDocument();
    expect(container.textContent).not.toContain("川中");
  });
});

describe("写真のフォールバック", () => {
  it.each(["ueda-moto", "kan-taiei", "kirii-daisuke", "ishihara-koshiro", "kotani-iori"])("%sは写真ではなく丸のイニシャル", id => {
    const { container } = render(<MemberCard member={member(id)} photo="https://example.com/unused.webp" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /イニシャル/ })).toHaveTextContent(Array.from(member(id).name)[0]);
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
