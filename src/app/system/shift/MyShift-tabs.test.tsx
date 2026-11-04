import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyShift from "./MyShift";

afterEach(() => vi.unstubAllGlobals());

function response(mode = "telema") {
  return {
    eligible: true, mode, editable: true,
    submit_months: [{ month: "2026-12", editable: true }],
    confirmed_months: [{ month: "2026-11" }],
    wish: [{ work_date: "2026-12-02", start_time: "14:00" }],
    confirmed: [{ work_date: "2026-11-02", start_time: "16:00", end_time: "20:00" }],
    submissions: [{ submitted_at: "2026-11-04T00:00:00Z", note: "希望" }],
  };
}

it.each(["telema", "default"])("%sの確定行だけの月は変更できず、備考・提出・月ラジオがない", async mode => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(response(mode))));
  render(<MyShift view="confirmed" />);
  await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0));
  expect(screen.getAllByRole("combobox").every(element => (element as HTMLSelectElement).disabled)).toBe(true);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出する" })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByText(/まだ確定していません/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^確定：/)).not.toBeInTheDocument();
});

it("確定が0か月なら案内だけを出す", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...response(), confirmed_months: [] })));
  render(<MyShift view="confirmed" />);
  await screen.findByText("確定したシフトはまだありません。");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it("スマホは提出で始まり、確定に切り替えると備考と提出ボタンが消える", async () => {
  const fetcher = vi.fn(async () => Response.json(response()));
  vi.stubGlobal("fetch", fetcher);
  render(<MyShift title="自分のシフト" />);
  await screen.findByRole("button", { name: "提出する" });
  expect(screen.getByRole("radio", { name: "提出" })).toBeChecked();
  expect(screen.queryByRole("radio", { name: "12月のシフト" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "確定" }));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0));
  expect(screen.queryByRole("button", { name: "提出する" })).not.toBeInTheDocument();
  expect(fetcher.mock.calls.some(call => String((call as unknown[])[0]).includes("view=confirmed"))).toBe(true);
});

it("月一覧の取得が終わるまで月とカレンダーを描かない", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<MyShift view="mine" />);
  expect(screen.getByText("読み込み中です…")).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
