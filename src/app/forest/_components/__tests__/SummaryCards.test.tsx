/**
 * T-F3-F8 Part A: SummaryCards の動的 sub 文言の回帰固定テスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f3-f8-summary-macro-polish.md §5 Part A, 判1
 * auto 推奨「現行 TSX 維持（動的計算）」に従い、`${countWithData}社合算` /
 * `${companies.length}社` / `${countWithData}社データあり` を回帰で固定する。
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SummaryCards } from "@/app/forest/_components/SummaryCards";
import type {
  Company,
  FiscalPeriod,
} from "@/app/forest/_constants/companies";

function makeCompany(id: string, short: string, sort: number): Company {
  return {
    id,
    name: `法人 ${id}`,
    short,
    kessan: "3",
    color: "#000000",
    light: "#ffffff",
    sort_order: sort,
  };
}

function makePeriod(
  id: number,
  company_id: string,
  ki: number,
  values: Partial<FiscalPeriod> = {},
): FiscalPeriod {
  return {
    id,
    company_id,
    ki,
    yr: 2025 + ki,
    period_from: "2026-04-01",
    period_to: "2027-03-31",
    uriage: 0,
    gaichuhi: 0,
    rieki: 0,
    junshisan: 0,
    genkin: 0,
    yokin: 0,
    doc_url: null,
    ...values,
  };
}

describe("SummaryCards - dynamic sub (T-F3-F8 Part A)", () => {
  it("shows `5社合算` when 5 of 6 companies have data (壱 unregistered)", () => {
    const companies = [
      makeCompany("ichi", "壱", 1), // no periods = 未登録
      makeCompany("hyuaran", "ヒュアラン", 2),
      makeCompany("centerrise", "センターライズ", 3),
      makeCompany("linksupport", "リンクサポート", 4),
      makeCompany("arata", "ARATA", 5),
      makeCompany("taiyou", "たいよう", 6),
    ];
    const periods = [
      makePeriod(1, "hyuaran", 7, { uriage: 100_000_000 }),
      makePeriod(2, "centerrise", 6, { uriage: 50_000_000 }),
      makePeriod(3, "linksupport", 4, { uriage: 40_000_000 }),
      makePeriod(4, "arata", 5, { uriage: 30_000_000 }),
      makePeriod(5, "taiyou", 4, { uriage: 10_000_000 }),
    ];

    render(<SummaryCards companies={companies} periods={periods} />);

    expect(screen.getByText("5社合算")).toBeInTheDocument();
    expect(screen.getByText("6社")).toBeInTheDocument(); // 総法人数
    expect(screen.getByText("5社データあり")).toBeInTheDocument();
  });

  it("shows `0社合算` when no company has data", () => {
    const companies = [makeCompany("a", "A法人", 1)];
    render(<SummaryCards companies={companies} periods={[]} />);

    expect(screen.getByText("0社合算")).toBeInTheDocument();
    expect(screen.getByText("1社")).toBeInTheDocument();
    expect(screen.getByText("0社データあり")).toBeInTheDocument();
  });

  it("renders the 5 expected card labels", () => {
    render(<SummaryCards companies={[]} periods={[]} />);

    for (const label of [
      "総売上高",
      "経常利益",
      "純資産",
      "現預金",
      "法人数",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("keeps static sub texts unchanged for 経常利益 / 純資産 / 現預金", () => {
    const companies = [makeCompany("a", "A", 1)];
    const periods = [makePeriod(1, "a", 1)];

    render(<SummaryCards companies={companies} periods={periods} />);

    expect(screen.getByText("営業外損益を含む")).toBeInTheDocument();
    expect(screen.getByText("総資産 − 総負債")).toBeInTheDocument();
    expect(screen.getByText("手許現金 + 銀行預金")).toBeInTheDocument();
  });
});
