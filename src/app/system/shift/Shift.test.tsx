import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { monthDays } from "@/lib/shift/rules";
vi.mock("@/app/system/_components/Modal/Modal", () => ({
  default: ({
    title,
    children,
    actions,
  }: {
    title: string;
    children: React.ReactNode;
    actions: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {actions}
    </div>
  ),
}));
import MyShift, { shiftMonths } from "./MyShift";
import ShiftDays from "./ShiftDays";
import { InitialUrlView } from "@/lib/ui/InitialUrlView";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import LineSendOverlay from "@/app/system/line/LineSendOverlay";
import ShiftManager, { TeamShift } from "./ShiftManager";
beforeEach(() => {
  vi.useRealTimers();
});
it("確定表の失敗した日に理由付きの印を表示する", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        people: [
          { employee_id: "1", name: "山田 太郎", current_team: "宮永チーム" },
        ],
        days: ["2099-12-02"],
        wish: [],
        submissions: [],
        holidays: [],
        candidates: [],
        confirmed: [
          {
            employee_id: "1",
            work_date: "2099-12-02",
            start_time: "14:00",
            kot_status: "failed",
            kot_error: "打刻があるため変更できません",
          },
        ],
        confirmation: {
          confirmed_at: "2026-11-03T10:00:00Z",
          confirmed_by_name: "責任者",
        },
        updated_at: null,
      }),
    ),
  );
  render(<TeamShift />);
  expect(await screen.findByRole("img", { name: "送信失敗" })).toHaveAttribute(
    "title",
    "打刻があるため変更できません",
  );
});
it("本人が月の日数分を提出し提出済みになる", async () => {
  const f = vi.fn(async (_url: unknown, init?: RequestInit) =>
    Response.json({
      eligible: true,
      submit_months: [{ month: shiftMonths().next, editable: true }],
      confirmed_months: [],
      editable: true,
      wish: [],
      confirmed: [],
      holidays: [],
      submissions:
        init?.method === "PUT"
          ? [{ submitted_at: "2026-11-03T10:00:00Z" }]
          : [],
    }),
  );
  vi.stubGlobal("fetch", f);
  render(<MyShift />);
  fireEvent.click(
    await screen.findByRole("button", { name: "全部の日に入力する" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /提出する$/ }));
  await screen.findByText("提出しました");
  const overlay = screen.getByRole("status", { name: "提出しました" });
  expect(overlay.querySelector("svg path")).toBeInTheDocument();
  expect(overlay).toHaveStyle({ background: "rgba(16, 35, 63, 0.9)" });
  const call = f.mock.calls.find((c) => c[1]?.method === "PUT")!;
  expect(JSON.parse(call[1]!.body as string).rows).toHaveLength(
    monthDays(
      new URL("http://local" + String(call[0])).searchParams.get("month")!,
    ).length,
  );
  expect(screen.getByText(/状態：提出済み/)).toBeInTheDocument();
});
it("次の月が確定したら本人は確定シフトを読むだけで見る", async () => {
  const month = shiftMonths().next;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        eligible: true,
        submit_months: [],
        confirmed_months: [{ month }],
        editable: true,
        wish: [{ work_date: month + "-02", start_time: "14:00:00" }],
        confirmed: [{ work_date: month + "-02", start_time: "16:00:00" }],
        holidays: [],
        submissions: [{ submitted_at: "2026-11-03T10:00:00Z" }],
        confirmation: {
          confirmed_at: "2026-11-20T10:00:00Z",
          confirmed_by_name: "責任者",
        },
      }),
    ),
  );
  render(<MyShift view="confirmed" />);
  await screen.findByText(/^確定：/);
  const select = screen.getByRole<HTMLSelectElement>("combobox", {
    name: /\/2\(.\)のシフト/,
  });
  expect(select.value).toBe("16:00");
  expect(select).toBeDisabled();
  expect(screen.queryByRole("button", { name: /提出する$/ })).toBeNull();
});
it("責任者が行を押して月の小窓を開き、確定前に確認する", async () => {
  const d = {
    people: [
      { employee_id: "1", name: "山田 太郎", current_team: "宮永チーム" },
    ],
    days: ["2026-12-01"],
    wish: [],
    confirmed: [],
    submissions: [],
    holidays: [],
    confirmation: null,
    updated_at: null,
    candidates: [],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(d)),
  );
  render(<TeamShift />);
  fireEvent.click(await screen.findByText("山田 太郎", { selector: "button" }));
  expect(
    screen.getByRole("dialog", { name: /山田 太郎さんのシフト/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "この月のシフトを確定する" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("dialog", { name: "シフトを確定しますか" }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByText(/定休日以外の希望をそのまま/)).toBeInTheDocument();
});

function teamData() {
  return {
    people: [
      { employee_id: "1", name: "山田 太郎", current_team: "宮永チーム" },
    ],
    days: monthDays("2026-12"),
    wish: [
      {
        employee_id: "1",
        work_date: "2026-12-01",
        start_time: "14:00",
        updated_at: "2026-11-03T01:00:00Z",
      },
    ],
    confirmed: [
      {
        employee_id: "1",
        work_date: "2026-12-01",
        start_time: "15:00",
        updated_at: "2026-11-03T02:00:00Z",
      },
    ],
    submissions: [],
    holidays: [] as string[],
    confirmation: null,
    updated_at: "2026-11-03T03:00:00Z",
    candidates: monthDays("2026-12").map((work_date, index) => ({
      work_date,
      hours: index,
    })),
  };
}

it("1日1つの選択欄で休みと勤務を切り替え、定休日には欄を出さない", () => {
  const onChange = vi.fn();
  render(
    <ShiftDays
      rows={[
        { work_date: "2026-12-01", start_time: null },
        { work_date: "2026-12-05", start_time: "10:00" },
        { work_date: "2026-12-06", start_time: null },
      ]}
      holidays={["2026-12-06"]}
      onChange={onChange}
    />,
  );
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: "12/6(日)のシフト" }),
  ).not.toBeInTheDocument();
  const weekday = screen.getByRole("combobox", { name: "12/1(火)のシフト" });
  fireEvent.change(weekday, { target: { value: "14:30" } });
  expect(onChange.mock.calls[0][0][0].start_time).toBe("14:30");
  fireEvent.change(screen.getByRole("combobox", { name: "12/5(土)のシフト" }), {
    target: { value: "" },
  });
  expect(onChange.mock.calls[1][0][1].start_time).toBeNull();
  expect(weekday.querySelector('option[value="10:00"]')).toBeNull();
  expect(
    screen
      .getByRole("combobox", { name: "12/5(土)のシフト" })
      .querySelector('option[value="10:00"]'),
  ).toHaveTextContent("10:00〜21:00");
});

it("候補は10日から展開し、即時反映して失敗時に戻す", async () => {
  const data = teamData();
  let rejectSave: (response: Response) => void = () => {};
  const fetchMock = vi.fn((_url: unknown, init?: RequestInit) =>
    init?.method === "POST"
      ? new Promise<Response>((resolve) => {
          rejectSave = resolve;
        })
      : Promise.resolve(Response.json(data)),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<TeamShift />);
  const first = await screen.findByRole("button", { name: "12/1(火) 0時間" });
  expect(
    screen.queryByRole("button", { name: "12/11(金) 10時間" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "すべての日を表示" }));
  expect(
    screen.getByRole("button", { name: "12/31(木) 30時間" }),
  ).toBeInTheDocument();
  fireEvent.click(first);
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(first).toHaveTextContent("定休日");
  rejectSave(
    Response.json({ error: "保存できませんでした。" }, { status: 500 }),
  );
  await screen.findByText("保存できませんでした。");
  expect(first).toHaveAttribute("aria-pressed", "false");
  expect(
    fetchMock.mock.calls.filter((call) => call[1]?.method === "POST"),
  ).toHaveLength(1);
});

it("定休日を再度押すと解除し、表を残して取り直す", async () => {
  const data = teamData();
  data.holidays = ["2026-12-01"];
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      data.holidays = [];
      return Response.json({ ok: true });
    }
    return Response.json(data);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TeamShift />);
  const first = await screen.findByRole("button", {
    name: "12/1(火) 0時間 定休日",
  });
  fireEvent.click(first);
  expect(first).toHaveAttribute("aria-pressed", "false");
  expect(
    screen.getByRole("table", { name: "みんなのシフト" }),
  ).toBeInTheDocument();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});

it("tab=teamを初回から表示し、更新日時は希望と確定の最新を使う", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(teamData())),
  );
  render(
    <InitialUrlView search="?tab=team">
      <SystemViewProvider
        value={{
          pageKey: "system-shift",
          admin: false,
          canAdd: false,
          tabs: ["mine", "team"].map((key) => ({
            key,
            label: key,
            allowed: true,
            canAdd: false,
          })),
        }}
      >
        <ShiftManager />
      </SystemViewProvider>
    </InitialUrlView>,
  );
  expect(screen.getByRole("tab", { name: "みんなのシフト" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.queryByRole("heading", { name: "みんなのシフト" }),
  ).not.toBeInTheDocument();
  await screen.findByRole("table");
  expect(
    screen.getByRole("columnheader", { name: "氏名" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("rowheader", { name: "宮永チーム" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("最終更新：2026/11/03(火) 11:00:00"),
  ).toBeInTheDocument();
});

it("希望も確定も空なら未取得の表示を出さない", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ ...teamData(), wish: [], confirmed: [] }),
    ),
  );
  render(<TeamShift />);
  await screen.findByRole("table");
  expect(screen.queryByText(/最終更新：/)).not.toBeInTheDocument();
});

it("LINEの完了も共通のチェック付き幕を使い、失敗時には閉じられる", () => {
  const close = vi.fn();
  render(
    <LineSendOverlay
      state={{ phase: "done", sent: 2, failed: 1 }}
      onClose={close}
    />,
  );
  const overlay = screen.getByRole("status", {
    name: "2人に送信しました。1人への送信に失敗しました。",
  });
  expect(overlay.querySelector("svg")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
  expect(close).toHaveBeenCalledOnce();
});
