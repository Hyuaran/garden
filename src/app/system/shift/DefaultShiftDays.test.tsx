import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MyShift from "./MyShift";
import DefaultShiftDays from "./DefaultShiftDays";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("既定の勤務だけを表示し、休みの日は勤務を選べない", () => {
  const rows = [
    { work_date: "2027-01-04", start_time: "09:30", end_time: "18:00", day_kind: "work" as const },
    { work_date: "2027-01-09", start_time: null, end_time: null, day_kind: "rest" as const },
  ];
  const changed = vi.fn();
  render(<DefaultShiftDays rows={rows} defaults={rows} onChange={changed} />);
  const work = screen.getByRole("combobox", { name: "1/4(月)のシフト" });
  expect(within(work).getAllByRole("option").map(option => option.textContent)).toEqual(["09:30〜18:00", "休み", "有給"]);
  expect(within(screen.getByRole("combobox", { name: "1/9(土)のシフト" })).getAllByRole("option").map(option => option.textContent)).toEqual(["休み", "有給"]);
  fireEvent.change(work, { target: { value: "paid" } });
  expect(changed.mock.calls[0][0][0]).toMatchObject({ start_time: null, end_time: null, day_kind: "paid" });
  expect(screen.queryByRole("button", { name: "全部の日に入力する" })).not.toBeInTheDocument();
});
it("本人が既定のまま提出すると開始・終了・種別を一緒に送る", async () => {
  // 実時間を使い、通信はローカルのモックだけ。
  const row = { work_date: "2027-01-04", start_time: "09:30", end_time: "18:00", day_kind: "work" };
  const fetcher = vi.fn(async () => Response.json({ eligible: true, mode: "default", editable: true, wish: [row], defaults: [row], submissions: [] }));
  vi.stubGlobal("fetch", fetcher);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-04T12:00:00+09:00"));
  render(<MyShift />);
  fireEvent.click(await screen.findByRole("button", { name: "提出する" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const init = (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1];
  const sent = JSON.parse(String(init.body));
  expect(sent.rows.find((day: { work_date: string }) => day.work_date === row.work_date)).toMatchObject(row);
});
