/**
 * T-F5-02: TaxFileStatusBadge のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 3
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TaxFileStatusBadge } from "@/app/forest/_components/TaxFileStatusBadge";

describe("TaxFileStatusBadge", () => {
  it("renders '＜ 確定 ＞' for kakutei status", () => {
    render(<TaxFileStatusBadge status="kakutei" />);
    expect(screen.getByText(/確定/)).toBeInTheDocument();
  });

  it("renders '＜ 暫定 ＞' for zantei status", () => {
    render(<TaxFileStatusBadge status="zantei" />);
    expect(screen.getByText(/暫定/)).toBeInTheDocument();
  });

  it("uses 全角 angle brackets (v9 準拠)", () => {
    render(<TaxFileStatusBadge status="kakutei" />);
    // 「＜」と「＞」を含む（半角ではない）
    expect(screen.getByText(/＜.*確定.*＞/)).toBeInTheDocument();
  });
});
