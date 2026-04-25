/**
 * T-F11-01: TaxDetailModal のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f11-01-tax-detail-modal.md §10
 *
 * - loading / error / 正常 / items 0/1/2+ の各状態
 * - 済みバッジ
 * - Esc / 背景クリックで閉じる
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Company } from "@/app/forest/_constants/companies";
import type {
  NouzeiScheduleDetail,
} from "@/app/forest/_lib/types";

vi.mock("@/app/forest/_lib/queries", () => ({
  fetchNouzeiDetail: vi.fn(),
  createNouzeiFileSignedUrl: vi.fn(),
}));

import { TaxDetailModal } from "@/app/forest/_components/TaxDetailModal";
import {
  fetchNouzeiDetail,
  createNouzeiFileSignedUrl,
} from "@/app/forest/_lib/queries";

const company: Company = {
  id: "hyuaran",
  name: "株式会社ヒュアラン",
  short: "ヒュアラン",
  kessan: "3",
  color: "#1e3a8a",
  light: "#bfdbfe",
  sort_order: 1,
};

function makeDetail(
  overrides: Partial<NouzeiScheduleDetail> = {},
): NouzeiScheduleDetail {
  return {
    id: "sched-1",
    company_id: "hyuaran",
    kind: "yotei",
    label: "予定",
    year: 2026,
    month: 11,
    due_date: "2026-11-30",
    total_amount: 2_324_000,
    status: "pending",
    paid_at: null,
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    items: [
      {
        id: "i1",
        schedule_id: "sched-1",
        label: "法人税等",
        amount: 891_600,
        sort_order: 1,
        created_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "i2",
        schedule_id: "sched-1",
        label: "消費税等",
        amount: 1_432_400,
        sort_order: 2,
        created_at: "2026-04-01T00:00:00Z",
      },
    ],
    files: [],
    ...overrides,
  };
}

describe("TaxDetailModal - 主要シナリオ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createNouzeiFileSignedUrl as unknown as Mock).mockResolvedValue("x");
  });

  it("renders the title with company.short and schedule.label", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/ヒュアラン/)).toBeInTheDocument();
    });
    expect(screen.getByText(/予定/)).toBeInTheDocument();
  });

  it("renders due_date as YYYY年M月末 期限", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    expect(
      await screen.findByText(/2026年11月末\s*期限/),
    ).toBeInTheDocument();
  });

  it("renders each item label and yen-formatted amount with comma", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    await screen.findByText(/2026年11月末/);
    expect(screen.getByText("法人税等")).toBeInTheDocument();
    expect(screen.getByText("消費税等")).toBeInTheDocument();
    expect(screen.getByText(/891,600\s*円/)).toBeInTheDocument();
    expect(screen.getByText(/1,432,400\s*円/)).toBeInTheDocument();
  });

  it("renders a 合計 row when items length >= 2", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("合計")).toBeInTheDocument();
    expect(screen.getByText(/2,324,000\s*円/)).toBeInTheDocument();
  });

  it("does NOT render 合計 when items length is 1", async () => {
    const oneItem = makeDetail({
      items: [makeDetail().items[0]],
      total_amount: 891_600,
    });
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(oneItem);
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    await screen.findByText("法人税等");
    expect(screen.queryByText("合計")).not.toBeInTheDocument();
  });

  it("renders '金額未確定' when items is empty", async () => {
    const noItems = makeDetail({ items: [], total_amount: null });
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(noItems);
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText(/金額未確定/)).toBeInTheDocument();
  });

  it("renders 済み badge when status=paid", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(
      makeDetail({ status: "paid", paid_at: "2026-04-01T00:00:00Z" }),
    );
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText(/済み/)).toBeInTheDocument();
  });

  it("does NOT render 済み badge when status=pending", async () => {
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    await screen.findByText(/2026年11月末/);
    expect(screen.queryByText(/済み/)).not.toBeInTheDocument();
  });
});

describe("TaxDetailModal - close interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createNouzeiFileSignedUrl as unknown as Mock).mockResolvedValue("x");
    (fetchNouzeiDetail as unknown as Mock).mockResolvedValue(makeDetail());
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={onClose}
      />,
    );

    await screen.findByText(/2026年11月末/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when 閉じる button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={onClose}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TaxDetailModal - error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createNouzeiFileSignedUrl as unknown as Mock).mockResolvedValue("x");
  });

  it("renders error text when fetchNouzeiDetail rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (fetchNouzeiDetail as unknown as Mock).mockRejectedValue(
      new Error("RLS denied"),
    );

    render(
      <TaxDetailModal
        scheduleId="sched-1"
        company={company}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText(/エラー.*RLS denied/)).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
