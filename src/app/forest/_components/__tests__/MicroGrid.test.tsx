/**
 * T-F9 採用差分（D2/D4/D8/D10）の TDD テスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f9-01-microgrid-diff-audit.md
 * 判断: a-main 経由 東海林さん回答「a-forest 推奨どおり 4 件採用」
 *   - D2: sticky col-company（左列固定）
 *   - D4: 進行期 glow animation
 *   - D8: 初期スクロール最右端
 *   - D10: zantei 専用スタイル
 *
 * 不採用（テスト対象外）: D1 / D3 / D5 / D6 / D7 / D9
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

import type {
  Company,
  FiscalPeriod,
  Shinkouki,
} from "@/app/forest/_constants/companies";

// DetailModal は fetchHankanhi 等を内部で呼ぶため副作用回避でスタブ化
vi.mock("@/app/forest/_components/DetailModal", () => ({
  DetailModal: () => null,
}));
vi.mock("@/app/forest/_lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { MicroGrid } from "@/app/forest/_components/MicroGrid";

// ---- test data ----

const hyuaran: Company = {
  id: "hyuaran",
  name: "ヒュアラン",
  short: "ヒュアラン",
  kessan: "3",
  color: "#1e3a8a",
  light: "#bfdbfe",
  sort_order: 1,
};

function makePeriod(overrides: Partial<FiscalPeriod> = {}): FiscalPeriod {
  return {
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
    ...overrides,
  };
}

function makeShinkouki(overrides: Partial<Shinkouki> = {}): Shinkouki {
  return {
    company_id: "hyuaran",
    ki: 8,
    yr: 2027,
    label: "進行期",
    range: "2027-04~2028-03",
    reflected: "2026/9 まで反映",
    zantei: false,
    uriage: 50_000_000,
    gaichuhi: 15_000_000,
    rieki: 5_000_000,
    ...overrides,
  };
}

// ---- D2: sticky col-company ----

describe("MicroGrid - D2 sticky col-company", () => {
  it("makes the company name <td> sticky on the left", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[makePeriod()]}
        shinkouki={[]}
      />,
    );
    // 法人名「ヒュアラン」を含む td に sticky 指定があること
    const companyCell = screen.getByText("ヒュアラン").closest("td");
    expect(companyCell).not.toBeNull();
    const style = companyCell!.getAttribute("style") ?? "";
    expect(style).toMatch(/position:\s*sticky/);
    expect(style).toMatch(/left:\s*0/);
  });

  it("makes the company column header <th> sticky on the left", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[makePeriod()]}
        shinkouki={[]}
      />,
    );
    const companyTh = screen.getByText("法人").closest("th");
    expect(companyTh).not.toBeNull();
    const style = companyTh!.getAttribute("style") ?? "";
    expect(style).toMatch(/position:\s*sticky/);
  });

  it("ensures sticky cell has a solid background to mask scrolling content", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[makePeriod()]}
        shinkouki={[]}
      />,
    );
    const companyCell = screen.getByText("ヒュアラン").closest("td");
    const style = companyCell!.getAttribute("style") ?? "";
    // background プロパティが設定されていること（透明だと sticky の意味なし）
    expect(style).toMatch(/background/);
  });
});

// ---- D4: 進行期 glow animation ----

describe("MicroGrid - D4 進行期 glow animation", () => {
  it("applies className 'shinkou-animate' to shinkouki cell wrapper", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[]}
        shinkouki={[makeShinkouki()]}
      />,
    );
    // 進行期の「第8期」バッジ → 親 div に className 'shinkou-animate'
    const shinkoukiBadge = screen.getByText("第8期");
    const animatedAncestor = shinkoukiBadge.closest(".shinkou-animate");
    expect(animatedAncestor).not.toBeNull();
  });

  it("does NOT apply 'shinkou-animate' className to confirmed period cells", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[makePeriod()]}
        shinkouki={[]}
      />,
    );
    const kibadge = screen.getByText("第7期");
    const animatedAncestor = kibadge.closest(".shinkou-animate");
    expect(animatedAncestor).toBeNull();
  });
});

// ---- D8: initial scroll right ----

describe("MicroGrid - D8 initial scroll to right edge", () => {
  it("scrolls the main grid container to the right edge on mount", async () => {
    // jsdom は scrollWidth を 0 で返すため、テスト用に固定値を返すモック
    const scrollWidthSpy = vi
      .spyOn(HTMLDivElement.prototype, "scrollWidth", "get")
      .mockReturnValue(2000);

    const { container } = render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[
          makePeriod({ id: 1, yr: 2024 }),
          makePeriod({ id: 2, yr: 2025 }),
          makePeriod({ id: 3, yr: 2026 }),
        ]}
        shinkouki={[]}
      />,
    );

    await waitFor(() => {
      const scrollDiv = container.querySelector(
        '[data-testid="microgrid-scroll"]',
      ) as HTMLDivElement | null;
      expect(scrollDiv).not.toBeNull();
      expect(scrollDiv!.scrollLeft).toBe(2000);
    });

    scrollWidthSpy.mockRestore();
  });
});

// ---- D10: zantei styling ----

describe("MicroGrid - D10 zantei専用スタイル", () => {
  /** 「第8期」バッジを含むセル td を取得（groupTotals 行の重複検出を回避）。 */
  function getShinkoukiCell(badge = "第8期"): HTMLElement {
    const cell = screen.getByText(badge).closest("td");
    if (!cell) throw new Error(`cell for badge=${badge} not found`);
    return cell as HTMLElement;
  }

  it("renders zantei (進行期かつ暫定) cell metric values in gray", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[]}
        shinkouki={[makeShinkouki({ zantei: true, uriage: 100_000_000 })]}
      />,
    );
    const cell = getShinkoukiCell();
    // uriage 100_000_000 → "1.0億"（セル内に絞って検索）
    const value = within(cell).getByText("1.0億");
    const style = value.getAttribute("style") ?? "";
    expect(style).toMatch(
      /color:\s*(?:#999|rgb\(\s*153,\s*153,\s*153\s*\))/i,
    );
  });

  it("renders zantei mini-bars with opacity 0.35", () => {
    const { container } = render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[]}
        shinkouki={[makeShinkouki({ zantei: true, uriage: 100_000_000 })]}
      />,
    );
    const miniBars = container.querySelectorAll(
      '[data-testid="microgrid-mini-bar"]',
    );
    expect(miniBars.length).toBeGreaterThan(0);
    miniBars.forEach((bar) => {
      const style = bar.getAttribute("style") ?? "";
      expect(style).toMatch(/opacity:\s*0\.35/);
    });
  });

  it("does NOT apply zantei styling when shinkouki.zantei=false", () => {
    render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[]}
        shinkouki={[makeShinkouki({ zantei: false, uriage: 100_000_000 })]}
      />,
    );
    const cell = getShinkoukiCell();
    const value = within(cell).getByText("1.0億");
    const style = value.getAttribute("style") ?? "";
    expect(style).not.toMatch(
      /color:\s*(?:#999|rgb\(\s*153,\s*153,\s*153\s*\))/i,
    );
  });

  it("does NOT apply zantei styling to confirmed period cells", () => {
    const { container } = render(
      <MicroGrid
        companies={[hyuaran]}
        periods={[makePeriod()]}
        shinkouki={[]}
      />,
    );
    const miniBars = container.querySelectorAll(
      '[data-testid="microgrid-mini-bar"]',
    );
    miniBars.forEach((bar) => {
      const style = bar.getAttribute("style") ?? "";
      expect(style).not.toMatch(/opacity:\s*0\.35/);
    });
  });
});
