import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import KotSendPanel from "./KotSendPanel";

it("送信欄・失敗一覧・確認小窓・進捗の幕を表示し、人ごとに順番に送る", async () => {
  let finish: (value: Response) => void = () => {};
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(Response.json({ sent: 0, failed: 1 }));
  vi.stubGlobal("fetch", fetch);
  const refresh = vi.fn();
  const busy = vi.fn();
  render(
    <KotSendPanel
      month="2099-12"
      prompt={0}
      onRefresh={refresh}
      onBusy={busy}
      people={[
        { employee_id: "1", name: "山田 太郎" },
        { employee_id: "2", name: "佐藤 花子" },
      ]}
      rows={[
        { employee_id: "1", work_date: "2099-12-02", kot_status: "unsent" },
        {
          employee_id: "2",
          work_date: "2099-12-03",
          kot_status: "failed",
          kot_error: "打刻があるため変更できません",
        },
      ]}
    />,
  );
  expect(screen.getByText("KING OF TIME への送信")).toBeInTheDocument();
  expect(screen.getByText(/失敗：佐藤 花子/)).toHaveTextContent(
    "打刻があるため変更できません",
  );
  fireEvent.click(screen.getByRole("button", { name: "KING OF TIME へ送る" }));
  expect(
    screen.getByText(
      "未送信・失敗の 2件を KING OF TIME の勤務予定に送ります。",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "送信する" }));
  const overlay = await screen.findByRole("status", {
    name: "2人中 1人目を送信しています…",
  });
  expect(overlay).toHaveStyle({ background: "rgba(16, 35, 63, 0.9)" });
  expect(fetch).toHaveBeenCalledTimes(1);
  finish(Response.json({ sent: 1, failed: 0 }));
  await screen.findByText("送信しました（成功 1件・失敗 1件）");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
  expect(busy.mock.calls).toEqual([[true], [false]]);
});

it("確定直後の確認を開き、受付停止の理由を表示する", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          error:
            "会社のパソコンの中継の係が古いため送れません。係の入れ替えが必要です。",
        },
        { status: 400 },
      ),
    ),
  );
  render(
    <KotSendPanel
      month="2099-12"
      prompt={1}
      onRefresh={() => {}}
      onBusy={() => {}}
      people={[{ employee_id: "1", name: "山田" }]}
      rows={[
        { employee_id: "1", work_date: "2099-12-02", kot_status: "unsent" },
      ]}
    />,
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "送信する" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "係の入れ替えが必要です",
    ),
  );
});
