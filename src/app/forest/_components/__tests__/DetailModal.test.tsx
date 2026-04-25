/**
 * T-F10-03 + T-F10-04: DetailModal のユニットテスト。
 *
 * - T-F10-03: 販管費内訳セクション（8 項目、fetchHankanhi 経由）
 * - T-F10-04: reflected note（進行期のみ表示）
 *
 * spec:
 *   - docs/specs/2026-04-24-forest-t-f10-03-hankanhi-detail-modal.md
 *   - docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md §4.10
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { CellData } from "@/app/forest/_constants/companies";
import { HANKANHI_LABELS, type Hankanhi } from "@/app/forest/_lib/types";

vi.mock("@/app/forest/_lib/queries", () => ({
  fetchHankanhi: vi.fn(),
}));
vi.mock("@/app/forest/_lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { DetailModal } from "@/app/forest/_components/DetailModal";
import { fetchHankanhi } from "@/app/forest/_lib/queries";

const baseCellData: CellData = {
  company: {
    id: "hyuaran",
    name: "株式会社ヒュアラン",
    short: "ヒュアラン",
    kessan: "3",
    color: "#1e3a8a",
    light: "#bfdbfe",
    sort_order: 1,
  },
  ki: 7,
  yr: 2026,
  period_from: "2026/4",
  period_to: "2027/3",
  uriage: 100_000_000,
  gaichuhi: 30_000_000,
  rieki: 10_000_000,
  junshisan: 50_000_000,
  genkin: 5_000_000,
  yokin: 20_000_000,
  doc_url: "https://drive.google.com/file/d/xxx",
  isShinkouki: false,
  reflected: null,
  zantei: false,
};

const fullHankanhi: Hankanhi = {
  id: "11111111-1111-1111-1111-111111111111",
  company_id: "hyuaran",
  fiscal_period_id: null,
  ki: 7,
  yakuin: 6_000_000,
  kyuyo: 3_335_358,
  settai: 4_042_193,
  kaigi: 1_128_464,
  ryohi: 5_170_944,
  hanbai: 101_738,
  chidai: 6_714_996,
  shiharai: 1_318_868,
  source: "csv",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
};

/** fetchHankanhi の結果を反映するための micro-task flush。 */
async function flushEffects() {
  await waitFor(() => {
    expect(fetchHankanhi).toHaveBeenCalled();
  });
  // useEffect -> setState -> re-render の一連を確実に待つ
  await new Promise((r) => setTimeout(r, 10));
}

describe("DetailModal - 主要 6 行（既存挙動の回帰防止）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHankanhi as unknown as Mock).mockResolvedValue(null);
  });

  it("renders all 6 primary rows", () => {
    render(<DetailModal data={baseCellData} onClose={() => {}} />);
    for (const label of [
      "売上高",
      "外注費",
      "経常利益",
      "純資産",
      "現金",
      "預金",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("DetailModal - 販管費内訳セクション (T-F10-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT render 販管費内訳 section when fetchHankanhi returns null", async () => {
    (fetchHankanhi as unknown as Mock).mockResolvedValue(null);
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    await flushEffects();
    expect(screen.queryByText("販管費内訳")).not.toBeInTheDocument();
  });

  it("does NOT render section when all 8 hankanhi fields are null", async () => {
    const allNull: Hankanhi = {
      ...fullHankanhi,
      yakuin: null,
      kyuyo: null,
      settai: null,
      kaigi: null,
      ryohi: null,
      hanbai: null,
      chidai: null,
      shiharai: null,
    };
    (fetchHankanhi as unknown as Mock).mockResolvedValue(allNull);
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    await flushEffects();
    expect(screen.queryByText("販管費内訳")).not.toBeInTheDocument();
  });

  it("renders 販管費内訳 section with all 8 labels when data is present", async () => {
    (fetchHankanhi as unknown as Mock).mockResolvedValue(fullHankanhi);
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    expect(await screen.findByText("販管費内訳")).toBeInTheDocument();
    for (const { label } of HANKANHI_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders `―` fallback when a field is null but others are non-null", async () => {
    const partial: Hankanhi = { ...fullHankanhi, kyuyo: null };
    (fetchHankanhi as unknown as Mock).mockResolvedValue(partial);
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    await screen.findByText("販管費内訳");
    const kyuyoRow = screen.getByText("給与手当").closest("tr");
    expect(kyuyoRow).not.toBeNull();
    expect(kyuyoRow!).toHaveTextContent("―");
  });

  it("calls fetchHankanhi with the cell's (company_id, ki)", async () => {
    (fetchHankanhi as unknown as Mock).mockResolvedValue(null);
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    await waitFor(() =>
      expect(fetchHankanhi).toHaveBeenCalledWith("hyuaran", 7),
    );
  });

  it("hides the section when fetchHankanhi rejects (treat as no data)", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (fetchHankanhi as unknown as Mock).mockRejectedValue(
      new Error("RLS denied"),
    );
    render(<DetailModal data={baseCellData} onClose={() => {}} />);

    await flushEffects();
    expect(screen.queryByText("販管費内訳")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe("DetailModal - reflected note (T-F10-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHankanhi as unknown as Mock).mockResolvedValue(null);
  });

  it("does NOT render reflected note for a confirmed period", () => {
    render(
      <DetailModal
        data={{
          ...baseCellData,
          isShinkouki: false,
          reflected: "2026/3まで反映",
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/※2026\/3まで反映/)).not.toBeInTheDocument();
  });

  it("does NOT render reflected note when reflected is null even on 進行期", () => {
    render(
      <DetailModal
        data={{ ...baseCellData, isShinkouki: true, reflected: null }}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/※/)).not.toBeInTheDocument();
  });

  it("does NOT render reflected note when reflected is empty string", () => {
    render(
      <DetailModal
        data={{ ...baseCellData, isShinkouki: true, reflected: "" }}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/※/)).not.toBeInTheDocument();
  });

  it("renders reflected note when 進行期 AND reflected is non-empty", () => {
    render(
      <DetailModal
        data={{
          ...baseCellData,
          isShinkouki: true,
          reflected: "2026/3まで反映",
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/※2026\/3まで反映/)).toBeInTheDocument();
  });
});
