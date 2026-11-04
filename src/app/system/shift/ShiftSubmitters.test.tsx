import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShiftSubmitters from "./ShiftSubmitters";
import MyShift from "./MyShift";

const employees = [
  { employee_id: "1", name: "山田", employment_type: "アルバイト", business: "ブロードバンド事業", current_team: "宮永チーム", is_active: true },
  { employee_id: "2", name: "藤木", employment_type: "outsource", current_team: "石原チーム", is_active: true },
];
beforeEach(() => vi.restoreAllMocks());
it("追加・ごみ箱・元に戻すを即時反映し、変更を親へ伝える", async () => {
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => Response.json(
    init?.method ? { ok: true } : { employees, settings: [] }));
  vi.stubGlobal("fetch", fetcher);
  const changed = vi.fn();
  render(<ShiftSubmitters onChanged={changed} onBusy={vi.fn()} />);
  await screen.findByText("山田");
  fireEvent.click(screen.getByRole("button", { name: "＋ 提出する人を追加" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "藤木" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(screen.getByText("シフトを提出する人（2人）")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "藤木を提出する人から外す" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("藤木")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "山田を提出する人から外す" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
  expect(screen.getByText("提出しない人に設定した人")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(4));
  expect(screen.queryByText("提出しない人に設定した人")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(call => call[1]?.method).map(call => call[1]?.method)).toEqual(["POST", "DELETE", "POST", "DELETE"]);
});
it("失敗したら戻して知らせる", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) =>
    init?.method ? Response.json({ error: "保存できませんでした。" }, { status: 500 }) : Response.json({ employees, settings: [] })));
  render(<ShiftSubmitters onChanged={vi.fn()} onBusy={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "山田を提出する人から外す" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "山田を提出する人から外す" })).toBeInTheDocument();
});
it("本人が対象外なら提出欄を出さない", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ eligible: false })));
  render(<MyShift />);
  expect(await screen.findByText("シフトの提出はありません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出する" })).not.toBeInTheDocument();
});
