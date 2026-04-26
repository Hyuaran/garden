import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CeoStatusEditor } from "../CeoStatusEditor";

global.fetch = vi.fn();

describe("CeoStatusEditor", () => {
  beforeEach(() => { (global.fetch as any).mockReset(); });

  it("renders 4 status radio options", () => {
    render(<CeoStatusEditor isSuperAdmin={true} />);
    expect(screen.getByLabelText(/対応可能/)).toBeInTheDocument();
    expect(screen.getByLabelText(/取り込み中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/集中業務中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/外出中/)).toBeInTheDocument();
  });

  it("does not render when not super_admin", () => {
    const { container } = render(<CeoStatusEditor isSuperAdmin={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("submits PUT on save click", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "busy", summary: "test" }),
    });
    render(<CeoStatusEditor isSuperAdmin={true} />);
    fireEvent.click(screen.getByLabelText(/取り込み中/));
    fireEvent.change(screen.getByLabelText(/メモ/), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ceo-status",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
