import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InnoveraSyncClient from "./InnoveraSyncClient";

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const baseResult = {
  ok: true,
  applied: false,
  trigger: "manual",
  ranAt: "2026-10-07T05:40:00.000Z",
  innoveraCount: 2,
  kintoneCount: 1,
  actions: [],
  counts: { added: 1, renamed: 1, retired: 0, needsReview: 0, failed: 0 },
  details: [
    { kind: "added", circuitNum: "180", lineNumber: "05088968665", fdNumber: "08006000830", issuedDate: "2026-09-16", nextName: "新規", result: "pending" },
    { kind: "renamed", circuitNum: "093", lineNumber: "08006000585", previousName: "旧名", nextName: "新名", result: "pending" },
  ],
};

describe("InnoveraSyncClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the difference list", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response(baseResult)));
    render(<InnoveraSyncClient initialLogs={[]} />);

    expect(screen.getByRole("heading", { name: "INNOVERA番号の同期" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "業務管理ツール" })).toHaveAttribute("href", "/system/forms");
    fireEvent.click(screen.getByRole("button", { name: "いまの差分を見る" }));

    expect(await screen.findByText("180")).toBeInTheDocument();
    expect(screen.getByText("08006000830 ／ 新規（発番 2026-09-16）")).toBeInTheDocument();
    expect(screen.getByText("名称変更")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐ反映" })).not.toBeDisabled();
  });

  it("shows an empty message when there are no differences", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ ...baseResult, counts: { added: 0, renamed: 0, retired: 0, needsReview: 0, failed: 0 }, details: [] })));
    render(<InnoveraSyncClient initialLogs={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "いまの差分を見る" }));

    expect(await screen.findByText("差分はありません。Kintone は最新です。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐ反映" })).toBeDisabled();
  });

  it("shows a red failure line", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ ...baseResult, ok: false, error: "innovera_empty", details: [] }, 500)));
    render(<InnoveraSyncClient initialLogs={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "いまの差分を見る" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/INNOVERA から回線が 1 件も返りませんでした/);
  });

  it("enables apply only after a preview and refreshes after apply", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response(baseResult))
      .mockImplementationOnce(() => response({
        ...baseResult,
        applied: true,
        counts: { added: 1, renamed: 1, retired: 0, needsReview: 0, failed: 0 },
        details: [
          { ...baseResult.details[0], result: "created" },
          { ...baseResult.details[1], result: "updated" },
        ],
        latestLogs: [{
          id: 1,
          ran_at: "2026-10-07T05:41:00.000Z",
          trigger: "manual",
          applied: true,
          ok: true,
          innovera_count: 2,
          kintone_count: 1,
          added: 1,
          renamed: 1,
          retired: 0,
          needs_review: 0,
          failed: 0,
          details: [],
          error: null,
          actor_employee_id: "EMP-1",
        }],
      }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InnoveraSyncClient initialLogs={[]} />);

    expect(screen.getByRole("button", { name: "今すぐ反映" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "いまの差分を見る" }));
    await screen.findByText("180");
    fireEvent.click(screen.getByRole("button", { name: "今すぐ反映" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/system/innovera-sync", { method: "POST" }));
    expect(await screen.findByText("差分はありません。Kintone は最新です。")).toBeInTheDocument();
  });

  it("uses only applied logs for the latest applied summary", () => {
    render(<InnoveraSyncClient initialLogs={[
      {
        id: 2,
        ran_at: "2026-10-07T05:42:00.000Z",
        trigger: "manual",
        applied: false,
        ok: true,
        innovera_count: 2,
        kintone_count: 1,
        added: 9,
        renamed: 0,
        retired: 0,
        needs_review: 0,
        failed: 0,
        details: [],
        error: null,
        actor_employee_id: "EMP-1",
      },
      {
        id: 1,
        ran_at: "2026-10-07T05:41:00.000Z",
        trigger: "manual",
        applied: true,
        ok: true,
        innovera_count: 2,
        kintone_count: 1,
        added: 1,
        renamed: 0,
        retired: 0,
        needs_review: 0,
        failed: 0,
        details: [],
        error: null,
        actor_employee_id: "EMP-1",
      },
    ]} />);

    expect(screen.getByLabelText("最後の反映")).toHaveTextContent("新規 1件");
    expect(screen.getByText("これまでの反映").parentElement).not.toHaveTextContent("新規 9件");
  });

  it("shows and closes the processing overlay while applying", async () => {
    let resolveApply: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response(baseResult))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveApply = resolve;
      }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InnoveraSyncClient initialLogs={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "いまの差分を見る" }));
    await screen.findByText("180");
    fireEvent.click(screen.getByRole("button", { name: "今すぐ反映" }));

    expect(screen.getByRole("status", { name: "Kintone に反映しています" })).toBeInTheDocument();
    resolveApply(new Response(JSON.stringify({ ...baseResult, applied: true, details: [], latestLogs: [] }), { headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Kintone に反映しています" })).not.toBeInTheDocument());
  });
});
