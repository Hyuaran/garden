import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import OrganizationChart from "./OrganizationChart";
import { organization } from "../_data/company-doc";

describe("データから組み立てる組織図", () => {
  it("代表の直下に3部、各部の直下に所属する課を持つ", () => {
    render(<OrganizationChart root={organization} />);
    const tree = screen.getByRole("list", { name: "組織図" });
    expect(tree.querySelector(":scope > li > div > [data-org-label]")).toHaveTextContent("代表取締役");
    const departments = [...tree.querySelectorAll(":scope > li > ul > li")];
    expect(departments).toHaveLength(3);
    expect(departments.map(node => node.querySelector(":scope > div > [data-org-label]")?.textContent)).toEqual(["SES事業部", "営業部", "総務部"]);
    expect(departments.map(node => [...node.querySelectorAll(":scope > ul > li > div > [data-org-label]")].map(label => label.textContent))).toEqual([
      ["インフラ課", "開発課"], ["テレマ課", "訪問販売課"], ["総務課（バックヤード）"],
    ]);
  });
  it("表示用に部名や人名を固定せずデータ追加に追従する", () => {
    render(<OrganizationChart root={{ label: "代表", children: [{ label: "新しい部", members: [{ name: "担当者A" }], children: [{ label: "新しい課", members: [{ name: "担当者B" }] }] }] }} />);
    expect(screen.getByText("新しい部")).toBeInTheDocument();
    expect(screen.getByText("新しい課")).toBeInTheDocument();
    expect(screen.getByText("担当者A")).toBeInTheDocument();
    expect(screen.getByText("担当者B")).toBeInTheDocument();
    expect(screen.queryByText("SES事業部")).not.toBeInTheDocument();
  });

  it("部・課の箱には部署名だけを置き、全13人を別の箱にする", () => {
    const { container } = render(<OrganizationChart root={organization} />);
    const labels = [...container.querySelectorAll("[data-org-label]")];
    expect(labels.map(label => label.textContent)).toEqual([
      "代表取締役", "SES事業部", "インフラ課", "開発課", "営業部", "テレマ課", "訪問販売課", "総務部", "総務課（バックヤード）",
    ]);
    const names = [...container.querySelectorAll("[data-org-name]")];
    expect(names).toHaveLength(13);
    for (const label of labels) {
      expect(label.querySelector("[data-org-member]")).toBeNull();
      for (const name of names) expect(label.textContent).not.toContain(name.textContent);
    }
  });

  it("テレマ課は役職と氏名を分けた3人分の箱を作る", () => {
    const { container } = render(<OrganizationChart root={organization} />);
    const cards = [...container.querySelectorAll('[data-org-branch="テレマ課"] > div > [data-org-members] > [data-org-member]')];
    expect(cards).toHaveLength(3);
    expect(cards.map(card => card.querySelector("[data-org-name]")?.textContent)).toEqual(["宮永　ひかり", "小泉　翔", "三好　理央"]);
    for (const card of cards) expect(card.firstElementChild).toHaveTextContent("チームリーダー");
  });

  it("総務部には人物の箱も空のコンテナも作らず、総務課には4人を表示する", () => {
    const { container } = render(<OrganizationChart root={organization} />);
    const department = container.querySelector('[data-org-branch="総務部"] > div')!;
    expect(department.querySelector("[data-org-members]")).toBeNull();
    expect(department.querySelector("[data-org-member]")).toBeNull();
    expect(container.querySelectorAll('[data-org-branch="総務課（バックヤード）"] [data-org-member]')).toHaveLength(4);
  });

  it("membersが空配列でも人物の空箱を作らない", () => {
    const { container } = render(<OrganizationChart root={{ label: "空の部署", members: [] }} />);
    expect(container.querySelector("[data-org-members]")).toBeNull();
  });

  it("指示書の役職・氏名対応を文字列分割せず保つ", () => {
    const { container } = render(<OrganizationChart root={organization} />);
    const actual = [...container.querySelectorAll("[data-org-branch]")].map(branch => ({
      label: branch.getAttribute("data-org-branch"),
      members: [...branch.querySelectorAll(":scope > div > [data-org-members] > [data-org-member]")].map(card => ({
        name: card.querySelector("[data-org-name]")?.textContent,
        role: card.children.length === 2 ? card.firstElementChild?.textContent : undefined,
      })),
    }));
    expect(actual).toEqual([
      { label: "代表取締役", members: [{ name: "後道　翔太" }] },
      { label: "SES事業部", members: [{ role: "SES事業部長", name: "金　亜奈" }] },
      { label: "インフラ課", members: [{ name: "インフラSE" }] },
      { label: "開発課", members: [{ name: "開発SE" }] },
      { label: "営業部", members: [{ role: "営業部長", name: "上田　基人" }] },
      { label: "テレマ課", members: [
        { role: "チームリーダー", name: "宮永　ひかり" },
        { role: "チームリーダー", name: "小泉　翔" },
        { role: "チームリーダー", name: "三好　理央" },
      ] },
      { label: "訪問販売課", members: [{ role: "訪問営業課長", name: "萩尾　拓也" }] },
      { label: "総務部", members: [] },
      { label: "総務課（バックヤード）", members: [
        { role: "BYリーダー", name: "東海林　美琴" },
        { role: "BY", name: "簡　棣榮" },
        { role: "BY補佐・システム開発", name: "槙　俊介" },
        { name: "BYアルバイト" },
      ] },
    ]);
  });

  it("氏名の長さから箱に収める文字サイズの基準を渡す", () => {
    const name = "長い氏名の担当者";
    const { container } = render(<OrganizationChart root={{ label: "部署", members: [{ name }] }} />);
    expect((container.querySelector("[data-org-name]") as HTMLElement).style.getPropertyValue("--org-name-length")).toBe(String(Array.from(name).length + 0.25));
  });

  it("配下の課の数に応じて幅を配分し、部署の追加にも追従する", () => {
    const { container } = render(<OrganizationChart root={{ label: "代表", children: [
      { label: "3課の部", children: [{ label: "A課" }, { label: "B課" }, { label: "C課" }] },
      { label: "1課の部", children: [{ label: "D課" }] },
    ] }} />);
    expect(container.querySelector('[data-org-branch="3課の部"]')).toHaveStyle({ flexGrow: 3 });
    expect(container.querySelector('[data-org-branch="1課の部"]')).toHaveStyle({ flexGrow: 1 });
  });
});
