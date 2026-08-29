import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceClient from "./AttendanceClient";

describe("AttendanceClient", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "123e4567-e89b-42d3-a456-426614174000") });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("shows the unregistered message without punch buttons", () => {
    render(<AttendanceClient registered={false} employeeName={null} canViewSync={false}/>);
    expect(screen.getByText(/打刻対象の従業員として登録されていません/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "出勤" })).not.toBeInTheDocument();
  });

  it("hides its own title and logout when embedded but keeps identity and sync status", () => {
    render(<AttendanceClient registered={false} employeeName="社員A" canViewSync embedded/>);
    expect(screen.queryByRole("heading", { name: "勤怠打刻" })).not.toBeInTheDocument();
    expect(screen.queryByText("Garden attendance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(screen.getByText("社員Aさん")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "同期状況" })).toBeInTheDocument();
  });

  it("keeps the standalone header without a duplicate logout when embedded is omitted", () => {
    render(<AttendanceClient registered={false} employeeName="社員A" canViewSync/>);
    expect(screen.getByRole("heading", { name: "勤怠打刻" })).toBeInTheDocument();
    expect(screen.getByText("Garden attendance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(screen.getByText("社員Aさん")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "同期状況" })).toBeInTheDocument();
  });

  it("opens immediately in saving state and confirms only after the server response", async () => {
    let resolvePunch!: (response: Response) => void;
    const punchPromise = new Promise<Response>((resolve) => { resolvePunch = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, punches: [] }), { status: 200 }))
      .mockReturnValueOnce(punchPromise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, punches: [{ id: 1, punch_type: "clock_in", punched_at: "2026-08-13T01:03:07Z", kot_sync_status: "unsent" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AttendanceClient registered employeeName="社員A" canViewSync={false}/>);
    await waitFor(() => expect(screen.getByText("まだ打刻はありません。")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "出勤" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("出勤を記録しています");
    expect(screen.queryByText("出勤を記録しました")).not.toBeInTheDocument();
    resolvePunch(new Response(JSON.stringify({ ok: true, punch: { punched_at: "2026-08-13T01:03:07Z" } }), { status: 201 }));
    await waitFor(() => expect(screen.getByText("出勤を記録しました")).toBeInTheDocument());
    expect(screen.getByRole("dialog").querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("✓");
    expect(screen.getAllByText("10:03:07")).toHaveLength(2);
    await waitFor(() => expect(screen.getByText("未送信")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      punch_type: "clock_in", client_punch_id: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("retries with the same client punch id", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, punches: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "failed" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, punch: { punched_at: "2026-08-13T01:03:07Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, punches: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AttendanceClient registered employeeName="社員A" canViewSync={false}/>);
    await waitFor(() => expect(screen.getByText("まだ打刻はありません。")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "退勤" }));
    await waitFor(() => expect(screen.getByText(/もう一度押してください/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(screen.getByText("退勤を記録しました")).toBeInTheDocument());
    const first = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const retry = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(retry.client_punch_id).toBe(first.client_punch_id);
  });
});
