import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PayrollNoticeClient from "./PayrollNoticeClient";

describe("PayrollNoticeClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the missing-token warning and disables submit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      ok: true,
      registered: false,
      reason: "名簿に登録なし",
    }));

    render(<PayrollNoticeClient submitterName="東海林 美琴" canViewHistory={false} />);

    expect(await screen.findByText("Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chatwork に送信" })).toBeDisabled();
  });

  it("shows required validation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      ok: true,
      registered: true,
      accountName: "東海林 美琴",
    }));

    render(<PayrollNoticeClient submitterName="東海林 美琴" canViewHistory={false} />);

    await screen.findByText("送信者：東海林 美琴（Chatwork：東海林 美琴 で投稿します）");
    fireEvent.click(screen.getByRole("button", { name: "Chatwork に送信" }));

    expect(await screen.findByText("「対象チーム」を選択してください。")).toBeInTheDocument();
    expect(screen.getByText("「交通費変更該当者」のいる／いないを選択してください。")).toBeInTheDocument();
    expect(screen.getByText("「その他共有事項」を入力してください。")).toBeInTheDocument();
  });

  it("submits and shows the sent message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/status")) {
        return Response.json({ ok: true, registered: true, accountName: "東海林 美琴" });
      }
      if (init?.method === "POST") {
        return Response.json({
          ok: true,
          notice: {
            id: "notice-1",
            submittedAt: "2026-09-07T09:30:00.000Z",
            submitterName: "東海林 美琴",
          },
        });
      }
      return Response.json({ ok: true, notices: [] });
    });

    render(<PayrollNoticeClient submitterName="東海林 美琴" canViewHistory={false} />);

    await screen.findByText("送信者：東海林 美琴（Chatwork：東海林 美琴 で投稿します）");
    fireEvent.click(screen.getByLabelText("宮永チーム"));
    fireEvent.click(screen.getAllByLabelText("いない")[0]);
    fireEvent.click(screen.getAllByLabelText("いない")[1]);
    fireEvent.click(screen.getAllByLabelText("いない")[2]);
    fireEvent.change(screen.getByPlaceholderText("共有したいことを入力してください"), { target: { value: "確認お願いします。" } });
    fireEvent.click(screen.getByRole("button", { name: "Chatwork に送信" }));

    await waitFor(() => expect(screen.getByText(/送信しました。/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/system/payroll-notice", expect.objectContaining({ method: "POST" }));
  });
});
