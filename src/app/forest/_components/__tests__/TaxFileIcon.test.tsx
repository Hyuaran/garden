/**
 * T-F5-02: TaxFileIcon のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 2
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TaxFileIcon } from "@/app/forest/_components/TaxFileIcon";

describe("TaxFileIcon", () => {
  it("renders 'PDF' label for .pdf files", () => {
    render(<TaxFileIcon fileName="test.pdf" />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("renders 'XLSX' label for .xlsx files", () => {
    render(<TaxFileIcon fileName="2024_summary.xlsx" />);
    expect(screen.getByText("XLSX")).toBeInTheDocument();
  });

  it("renders 'XLS' for legacy .xls files", () => {
    render(<TaxFileIcon fileName="legacy.xls" />);
    expect(screen.getByText("XLS")).toBeInTheDocument();
  });

  it("renders 'CSV' for .csv files", () => {
    render(<TaxFileIcon fileName="data.csv" />);
    expect(screen.getByText("CSV")).toBeInTheDocument();
  });

  it("renders 'JPG' for .jpg files", () => {
    render(<TaxFileIcon fileName="scan.jpg" />);
    expect(screen.getByText("JPG")).toBeInTheDocument();
  });

  it("renders 'JPG' for .jpeg files (treated equivalent)", () => {
    render(<TaxFileIcon fileName="scan.jpeg" />);
    expect(screen.getByText("JPG")).toBeInTheDocument();
  });

  it("renders 'PNG' for .png files", () => {
    render(<TaxFileIcon fileName="scan.png" />);
    expect(screen.getByText("PNG")).toBeInTheDocument();
  });

  it("falls back to extension uppercase for unknown extensions", () => {
    render(<TaxFileIcon fileName="archive.zip" />);
    expect(screen.getByText("ZIP")).toBeInTheDocument();
  });

  it("handles fileName without extension gracefully", () => {
    const { container } = render(<TaxFileIcon fileName="README" />);
    // 拡張子なし: 空文字 or fallback。コンポーネントはクラッシュしないこと
    expect(container.firstChild).not.toBeNull();
  });

  it("treats extension case-insensitively", () => {
    render(<TaxFileIcon fileName="UPPER.PDF" />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});
