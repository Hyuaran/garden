import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DefaultPatternSettings from "./DefaultPatternSettings";

afterEach(() => vi.unstubAllGlobals());

it("選べる勤務を追加・削除し、曜日の勤務と一緒に保存する", async () => {
  const fetcher = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  render(<DefaultPatternSettings
    employees={[{ employee_id: "E1", name: "事務", is_active: true, employment_type: "正社員" }]}
    settings={[]} patterns={[]}
    options={[{ employee_id: "E1", label: "在宅", start_time: "10:30:00", end_time: "14:30:00" }]}
    onChanged={vi.fn()} onBusy={vi.fn()} change={vi.fn()}
  />);
  fireEvent.click(screen.getByRole("button", { name: "事務" }));
  expect(screen.getByRole("textbox", { name: "1件目の勤務の名前" })).toHaveValue("在宅");
  fireEvent.click(screen.getByRole("button", { name: "＋ 選べる勤務を追加" }));
  fireEvent.change(screen.getByRole("textbox", { name: "2件目の勤務の名前" }), {
    target: { value: "出社" },
  });
  fireEvent.click(screen.getByRole("button", { name: "1件目の選べる勤務を削除" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(String(init.body))).toMatchObject({
    employee_id: "E1",
    options: [{ label: "出社", start_time: "09:00", end_time: "18:00" }],
  });
});
