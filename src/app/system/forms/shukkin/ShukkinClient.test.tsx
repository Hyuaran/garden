import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShukkinClient from "./ShukkinClient";

vi.mock("@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb", () => ({
  default: () => <nav aria-label="breadcrumb" />,
}));

const members = [
  { employeeNumber: "0004", name: "上田 基人", employmentType: "正社員", groupName: "テレマ社員", sortOrder: 10, active: true },
  { employeeNumber: "1165", name: "宮永 ひかり", employmentType: "正社員", groupName: "テレマ社員", sortOrder: 20, active: true },
  { employeeNumber: "1392", name: "田中 実花", employmentType: "アルバイト", groupName: "宮永チーム", sortOrder: 10, active: true },
  { employeeNumber: "1554", name: "小谷 智子", employmentType: "正社員", groupName: "新人チーム", sortOrder: 10, active: true },
];

const rows = [
  { employeeCode: "0004", name: "上田 基人", date: "2026-09-30", employmentKind: "正社員", workdayKind: "平日", patternName: "通常", plannedClockIn: "14:00", plannedClockOut: "21:00", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
  { employeeCode: "1165", name: "宮永 ひかり", date: "2026-09-30", employmentKind: "正社員", workdayKind: "平日", patternName: "通常", plannedClockIn: "14:00", plannedClockOut: "21:00", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
  { employeeCode: "1392", name: "田中 実花", date: "2026-09-30", employmentKind: "アルバイト", workdayKind: "平日", patternName: "通常", plannedClockIn: "10:00", plannedClockOut: "21:00", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
  { employeeCode: "1554", name: "小谷 智子", date: "2026-09-30", employmentKind: "正社員", workdayKind: "平日", patternName: "通常", plannedClockIn: "14:00", plannedClockOut: "21:00", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
  { employeeCode: "1165", name: "宮永 ひかり", date: "2026-10-01", employmentKind: "正社員", workdayKind: "公休", patternName: "", plannedClockIn: "", plannedClockOut: "", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
  { employeeCode: "1392", name: "田中 実花", date: "2026-10-01", employmentKind: "アルバイト", workdayKind: "平日", patternName: "通常", plannedClockIn: "10:00", plannedClockOut: "21:00", roundedClockIn: "", roundedClockOut: "", clockIn: "", clockOut: "" },
];

describe("ShukkinClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/system/shukkin/chatwork")) {
        return new Response(JSON.stringify({ ok: true, roomLabel: "開発ルーム（テスト）", sentAt: "2026-10-14T06:30:12.000Z" }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/members")) {
        return new Response(JSON.stringify({ ok: true, members }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/parse")) {
        return new Response(JSON.stringify({ ok: true, rows }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows editable seat counts above the target date and resets them when the date changes", async () => {
    render(<ShukkinClient canEditMembers={false} />);

    expect(screen.getByText("KING OF TIME ログイン＞エクスポート インポート＞データ出力 日別データCSV＞日付指定＞日付を本日/明日選択＞出力レイアウト Garden選択＞データ出力")).toBeInTheDocument();

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([""], "2026-09-30.csv", { type: "text/csv" })] } });

    await waitFor(() => expect(screen.getByText("読み込みました")).toBeInTheDocument());

    const seatRow = screen.getByText("席数").closest("div");
    expect(seatRow).not.toBeNull();
    expect(within(seatRow as HTMLElement).getByText("総席数")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText("リーダー")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText("アルバイト")).toBeInTheDocument();
    expect(seatRow?.compareDocumentPosition(screen.getByText("対象日"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const [totalInput, staffInput, partTimeInput] = within(seatRow as HTMLElement).getAllByRole("spinbutton");
    await waitFor(() => expect(staffInput).toHaveValue(1));

    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "＝ 3")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "残 22")).toBeInTheDocument();

    expect(totalInput).toHaveValue(25);
    expect(partTimeInput).toHaveValue(2);

    fireEvent.change(totalInput, { target: { value: "2" } });
    fireEvent.change(staffInput, { target: { value: "3" } });
    fireEvent.change(partTimeInput, { target: { value: "4" } });
    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "＝ 7")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "残 -5")).toBeInTheDocument();

    const dateSelect = screen.getByLabelText("対象日") as HTMLSelectElement;
    fireEvent.change(dateSelect, { target: { value: "2026-10-01" } });
    await waitFor(() => expect(staffInput).toHaveValue(0));
    expect(partTimeInput).toHaveValue(1);
    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "残 1")).toBeInTheDocument();
  });

  it("shows the Chatwork send dialog from the attendance tab and sends the current text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/system/shukkin/chatwork") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, sentAt: "2026-10-14T06:30:12.000Z" }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/chatwork")) {
        return new Response(JSON.stringify({ ok: true, roomLabel: "開発ルーム（テスト）" }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/members")) {
        return new Response(JSON.stringify({ ok: true, members }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/parse")) {
        return new Response(JSON.stringify({ ok: true, rows }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ShukkinClient canEditMembers={false} />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([""], "2026-09-30.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(screen.getByText("読み込みました")).toBeInTheDocument());

    const controls = screen.getByText("対象日").closest("div") as HTMLElement;
    const chatworkButton = within(controls).getByRole("button", { name: "Chatwork へ送信" });
    const copyButton = within(controls).getByRole("button", { name: "コピー" });
    expect(chatworkButton.compareDocumentPosition(copyButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const attendanceText = (document.querySelector("pre") as HTMLPreElement).textContent ?? "";
    fireEvent.click(chatworkButton);

    const dialog = await screen.findByRole("dialog", { name: "この内容で Chatwork に送信します" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("送り先：開発ルーム（テスト）")).toBeInTheDocument();
    expect(within(dialog).getByText((_, element) => element?.tagName === "PRE" && element.textContent === attendanceText)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(chatworkButton);
    fireEvent.click(await screen.findByRole("button", { name: "送信する" }));
    await waitFor(() => expect(screen.getByText("送信しました")).toBeInTheDocument());
    expect(screen.getByText("時刻：2026-10-14 15:30:12")).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/system/shukkin/chatwork") && init?.method === "POST");
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      text: attendanceText,
      date: "2026-09-30",
      time: "14:00",
    });
  });

  it("keeps the dialog open after a Chatwork failure and allows retry", async () => {
    let postCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/system/shukkin/chatwork") && init?.method === "POST") {
        postCount += 1;
        if (postCount === 1) {
          return new Response(JSON.stringify({ ok: false, error: "送れませんでした" }), { status: 502 });
        }
        return new Response(JSON.stringify({ ok: true, sentAt: "2026-10-14T06:30:12.000Z" }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/chatwork")) {
        return new Response(JSON.stringify({ ok: true, roomLabel: "開発ルーム（テスト）" }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/members")) {
        return new Response(JSON.stringify({ ok: true, members }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/parse")) {
        return new Response(JSON.stringify({ ok: true, rows }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }));
    render(<ShukkinClient canEditMembers={false} />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([""], "2026-09-30.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(screen.getByText("読み込みました")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Chatwork へ送信" }));
    fireEvent.click(await screen.findByRole("button", { name: "送信する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("送れませんでした");
    fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
    await waitFor(() => expect(screen.getByText("送信しました")).toBeInTheDocument());
    expect(postCount).toBe(2);
  });

  it("opens the official LINE dialog from the left of the copy button", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/system/shukkin/line-send")) {
        return new Response(JSON.stringify({
          ok: true,
          quota: 200,
          used: 20,
          remaining: 180,
          needed: 2,
          ownLinked: true,
          members: [
            { employeeNumber: "1392", name: "田中 実花", linked: true, blocked: false },
            { employeeNumber: "1554", name: "小谷 智子", linked: false, blocked: false },
          ],
        }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/members")) {
        return new Response(JSON.stringify({ ok: true, members }), { status: 200 });
      }
      if (url.endsWith("/api/system/shukkin/parse")) {
        return new Response(JSON.stringify({ ok: true, rows }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ShukkinClient canEditMembers={false} />);

    fireEvent.click(screen.getByRole("tab", { name: "シフト連絡（LINE）" }));
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([""], "2026-09-30.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(screen.getByText("読み込みました")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("対象日"), { target: { value: "2026-09-30" } });

    const lineButton = screen.getByRole("button", { name: "公式 LINE で送信" });
    const copyButton = screen.getByRole("button", { name: "送る相手と文面をまとめてコピー" });
    expect(lineButton.compareDocumentPosition(copyButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(lineButton);

    const dialog = await screen.findByRole("dialog", { name: "この内容で公式 LINE に送信します" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("今月の枠：残り 180 通／今回 1 通")).toBeInTheDocument();
    expect(within(dialog).getByText(/田中/)).toBeInTheDocument();
    expect(within(dialog).getByText("小谷（未）")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("自分だけに試し送り")).toBeEnabled();
  });
});
