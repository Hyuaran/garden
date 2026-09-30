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
    expect(within(seatRow as HTMLElement).getByText("社員")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText("アルバイト")).toBeInTheDocument();
    expect(seatRow?.compareDocumentPosition(screen.getByText("対象日"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const [totalInput, staffInput, partTimeInput] = within(seatRow as HTMLElement).getAllByRole("spinbutton");
    await waitFor(() => expect(staffInput).toHaveValue(2));

    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "＝ 3")).toBeInTheDocument();
    expect(within(seatRow as HTMLElement).getByText((_, element) => element?.textContent === "残 22")).toBeInTheDocument();

    expect(totalInput).toHaveValue(25);
    expect(partTimeInput).toHaveValue(1);

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
});
