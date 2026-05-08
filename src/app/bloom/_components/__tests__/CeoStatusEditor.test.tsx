import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CeoStatusEditor } from "../CeoStatusEditor";
import { ShojiStatusContext, type CeoStatus } from "../../../../components/shared/ShojiStatusContext";

global.fetch = vi.fn();

const refreshSpy = vi.fn(async () => {});

function withCtx(ui: React.ReactNode, status: CeoStatus | null = null) {
  return (
    <ShojiStatusContext.Provider
      value={{ status, loading: false, error: null, refresh: refreshSpy }}
    >
      {ui}
    </ShojiStatusContext.Provider>
  );
}

describe("CeoStatusEditor", () => {
  beforeEach(() => {
    (global.fetch as any).mockReset();
    refreshSpy.mockClear();
  });

  it("renders 4 status radio options", () => {
    render(withCtx(<CeoStatusEditor isSuperAdmin={true} />));
    expect(screen.getByLabelText(/対応可能/)).toBeInTheDocument();
    expect(screen.getByLabelText(/取り込み中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/集中業務中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/外出中/)).toBeInTheDocument();
  });

  it("does not render when not super_admin", () => {
    const { container } = render(withCtx(<CeoStatusEditor isSuperAdmin={false} />));
    expect(container.firstChild).toBeNull();
  });

  it("submits PUT on save click and shows success message + calls refresh", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "busy", summary: "test" }),
    });
    render(withCtx(<CeoStatusEditor isSuperAdmin={true} />));
    fireEvent.click(screen.getByLabelText(/取り込み中/));
    fireEvent.change(screen.getByLabelText(/メモ/), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ceo-status",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    await waitFor(() => expect(screen.getByText("更新しました")).toBeInTheDocument());
    expect(refreshSpy).toHaveBeenCalled();
  });

  it("shows error message on non-OK response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "forbidden" }),
    });
    render(withCtx(<CeoStatusEditor isSuperAdmin={true} />));
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    await waitFor(() => expect(screen.getByText(/更新失敗.*forbidden/)).toBeInTheDocument());
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("shows network error message on fetch rejection", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network fail"));
    render(withCtx(<CeoStatusEditor isSuperAdmin={true} />));
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    await waitFor(() => expect(screen.getByText(/通信エラー.*network fail/)).toBeInTheDocument());
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
