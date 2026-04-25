/**
 * T-F5-02: TaxFilesGroup のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 4
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { TaxFile } from "@/app/forest/_lib/types";

vi.mock("@/app/forest/_lib/queries", () => ({
  createTaxFileSignedUrl: vi.fn(),
}));

import { TaxFilesGroup } from "@/app/forest/_components/TaxFilesGroup";
import { createTaxFileSignedUrl } from "@/app/forest/_lib/queries";

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
    file_size_bytes: 123_456,
    created_at: "2026-04-25T00:00:00Z",
    updated_at: "2026-04-25T00:00:00Z",
    ...overrides,
  };
}

describe("TaxFilesGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the company label", () => {
    render(<TaxFilesGroup companyLabel="株式会社ヒュアラン" files={[]} />);
    expect(screen.getByText("株式会社ヒュアラン")).toBeInTheDocument();
  });

  it("shows '（データなし）' when files is empty AND defaultOpen=true", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[]}
        defaultOpen={true}
      />,
    );
    expect(screen.getByText(/データなし/)).toBeInTheDocument();
  });

  it("hides body when defaultOpen=false (collapsed)", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile()]}
        defaultOpen={false}
      />,
    );
    // ファイル名（doc_name）は表示されない
    expect(
      screen.queryByText("2024年度 確定申告書"),
    ).not.toBeInTheDocument();
  });

  it("toggles open/close when header button is clicked (with files)", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile()]}
        defaultOpen={true}
      />,
    );
    expect(screen.getByText("2024年度 確定申告書")).toBeInTheDocument();

    // クリックで折りたたみ
    fireEvent.click(screen.getByRole("button", { name: /ヒュアラン/ }));
    expect(
      screen.queryByText("2024年度 確定申告書"),
    ).not.toBeInTheDocument();

    // もう一度クリックで開く
    fireEvent.click(screen.getByRole("button", { name: /ヒュアラン/ }));
    expect(screen.getByText("2024年度 確定申告書")).toBeInTheDocument();
  });

  it("renders one file row per file", () => {
    const files = [
      makeFile({ id: "f1", doc_name: "2024年度 確定" }),
      makeFile({ id: "f2", doc_name: "2025年度 中間" }),
    ];
    render(
      <TaxFilesGroup companyLabel="ヒュアラン" files={files} defaultOpen />,
    );
    expect(screen.getByText("2024年度 確定")).toBeInTheDocument();
    expect(screen.getByText("2025年度 中間")).toBeInTheDocument();
  });

  it("calls createTaxFileSignedUrl + window.open when a file row is clicked", async () => {
    (createTaxFileSignedUrl as unknown as Mock).mockResolvedValue(
      "https://example.test/signed?t=abc",
    );
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile({ doc_name: "Click me" })]}
        defaultOpen
      />,
    );

    fireEvent.click(screen.getByText("Click me"));

    // promise resolution を待つ
    await vi.waitFor(() => {
      expect(createTaxFileSignedUrl).toHaveBeenCalledWith(
        "hyuaran/2024_kakutei.pdf",
        600,
      );
      expect(openSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it("renders the status badge for each file", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile({ status: "kakutei" })]}
        defaultOpen
      />,
    );
    expect(screen.getByText(/＜ 確定 ＞/)).toBeInTheDocument();
  });

  it("renders the note (with red color) when present", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile({ note: "訂正版あり" })]}
        defaultOpen
      />,
    );
    expect(screen.getByText(/訂正版あり/)).toBeInTheDocument();
  });

  it("renders aria-expanded reflecting open state", () => {
    render(
      <TaxFilesGroup
        companyLabel="ヒュアラン"
        files={[makeFile()]}
        defaultOpen={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /ヒュアラン/ });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });
});
