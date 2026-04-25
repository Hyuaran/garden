/**
 * T-F3-F8 Part B: MacroChart タイトル互換性テスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f3-f8-summary-macro-polish.md §5 Part B, 判2
 * v9 ブランド表現「～ 森の視界 ～」を含むタイトルへの変更を検証。
 *
 * react-chartjs-2 の Line は jsdom で canvas 未対応のためスタブで置換し、
 * 見出し表示のみを検証対象とする。
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart" />,
}));

import { MacroChart } from "@/app/forest/_components/MacroChart";
import type {
  Company,
  FiscalPeriod,
} from "@/app/forest/_constants/companies";

const hyuaran: Company = {
  id: "hyuaran",
  name: "株式会社ヒュアラン",
  short: "ヒュアラン",
  kessan: "3",
  color: "#1e3a8a",
  light: "#bfdbfe",
  sort_order: 1,
};

const samplePeriod: FiscalPeriod = {
  id: 1,
  company_id: "hyuaran",
  ki: 7,
  yr: 2026,
  period_from: "2026-04-01",
  period_to: "2027-03-31",
  uriage: 100_000_000,
  gaichuhi: 30_000_000,
  rieki: 10_000_000,
  junshisan: 50_000_000,
  genkin: 5_000_000,
  yokin: 20_000_000,
  doc_url: null,
};

describe("MacroChart - title (T-F3-F8)", () => {
  it("renders the v9 branded title with 森の視界", () => {
    render(<MacroChart companies={[hyuaran]} periods={[samplePeriod]} />);

    expect(
      screen.getByText(/グループ全体の合算利益推移 ～ 森の視界 ～/),
    ).toBeInTheDocument();
  });

  it("renders the Line chart when periods are non-empty", () => {
    render(<MacroChart companies={[hyuaran]} periods={[samplePeriod]} />);

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders nothing when periods is empty", () => {
    const { container } = render(
      <MacroChart companies={[hyuaran]} periods={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("MacroChart - height (F4: v9 互換 360px)", () => {
  it("wraps the Line chart in a 360px-tall container (v9 準拠)", () => {
    render(<MacroChart companies={[hyuaran]} periods={[samplePeriod]} />);

    // Line スタブの直接の親 <div> が height: 360 を持つことを確認
    const chartContainer =
      screen.getByTestId("line-chart").parentElement!;
    const style = chartContainer.getAttribute("style") ?? "";
    // jsdom は height: 360px のような px 単位文字列にする
    expect(style).toMatch(/height:\s*360px/);
  });
});
