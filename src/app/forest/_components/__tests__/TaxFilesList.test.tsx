/**
 * T-F5-02: TaxFilesList のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 5
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";

import type { Company } from "@/app/forest/_constants/companies";
import type { TaxFile } from "@/app/forest/_lib/types";

vi.mock("@/app/forest/_lib/queries", () => ({
  createTaxFileSignedUrl: vi.fn(),
}));

import { TaxFilesList } from "@/app/forest/_components/TaxFilesList";

const hyuaran: Company = {
  id: "hyuaran",
  name: "株式会社ヒュアラン",
  short: "ヒュアラン",
  kessan: "3",
  color: "#1e3a8a",
  light: "#bfdbfe",
  sort_order: 1,
};

const arata: Company = {
  id: "arata",
  name: "株式会社ARATA",
  short: "ARATA",
  kessan: "12",
  color: "#dc2626",
  light: "#fecaca",
  sort_order: 4,
};

function makeFile(overrides: Partial<TaxFile> = {}): TaxFile {
  return {
    id: "f1",
    company_id: "hyuaran",
    doc_name: "2024年度 確定申告書",
    file_name: "2024_kakutei.pdf",
    storage_path: "hyuaran/2024_kakutei.pdf",
    status: "kakutei",
    doc_date: "2024-03-31",
    uploaded_at: "2026-04-25T00:00:00Z",
    uploaded_by: null,
    note: null,
    mime_type: "application/pdf",
    file_size_bytes: 1000,
    created_at: "2026-04-25T00:00:00Z",
    updated_at: "2026-04-25T00:00:00Z",
    ...overrides,
  };
}

describe("TaxFilesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title 税理士連携データ", () => {
    render(<TaxFilesList companies={[hyuaran]} taxFiles={[]} />);
    expect(screen.getByText("税理士連携データ")).toBeInTheDocument();
  });

  it("shows the empty message when no tax files exist", () => {
    render(<TaxFilesList companies={[hyuaran]} taxFiles={[]} />);
    expect(
      screen.getByText(/まだファイルが連携されていません/),
    ).toBeInTheDocument();
  });

  it("renders one TaxFilesGroup per company in TAX_FILE_COMPANY_ORDER", () => {
    const files = [makeFile({ id: "f1", company_id: "hyuaran" })];
    render(<TaxFilesList companies={[hyuaran, arata]} taxFiles={files} />);
    // hyuaran と arata が両方表示される（TAX_FILE_COMPANY_ORDER 順）
    expect(screen.getByText("株式会社ヒュアラン")).toBeInTheDocument();
    expect(screen.getByText("株式会社ARATA")).toBeInTheDocument();
  });

  it("groups files by company_id", () => {
    const files = [
      makeFile({ id: "f1", company_id: "hyuaran", doc_name: "ヒュアランのファイル" }),
      makeFile({ id: "f2", company_id: "arata", doc_name: "ARATAのファイル" }),
    ];
    render(<TaxFilesList companies={[hyuaran, arata]} taxFiles={files} />);
    expect(screen.getByText("ヒュアランのファイル")).toBeInTheDocument();
    expect(screen.getByText("ARATAのファイル")).toBeInTheDocument();
  });

  it("does NOT show the empty section message when at least one file exists", () => {
    render(
      <TaxFilesList
        companies={[hyuaran]}
        taxFiles={[makeFile()]}
      />,
    );
    expect(
      screen.queryByText(/まだファイルが連携されていません/),
    ).not.toBeInTheDocument();
  });

  it("renders empty companies (no files) as collapsed groups (data なし)", () => {
    // hyuaran にはファイルあり、arata にはなし（TAX_FILE_COMPANY_ORDER に両方あり）
    const files = [makeFile({ id: "f1", company_id: "hyuaran" })];
    render(<TaxFilesList companies={[hyuaran, arata]} taxFiles={files} />);
    // ARATA グループは collapsed なので 'データなし' は表示されない
    // （defaultOpen={false} の検証）
    expect(screen.queryByText(/データなし/)).not.toBeInTheDocument();
  });
});
