import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InnoveraCallsClient from "./InnoveraCallsClient";

vi.mock("@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb", () => ({
  default: () => <nav aria-label="breadcrumb" />,
}));

const callsPayload = {
  ok: true,
  calls: [
    {
      id: "cdr-1",
      uniqid: "u1",
      startTime: "2026-10-08 13:54:00",
      displayTime: "13:54",
      type: "2",
      typeLabel: "発信",
      status: "1",
      statusLabel: "通話成功",
      circuitId: "line-1",
      circuitName: "トーカリのプロ",
      extension: "2040",
      employeeName: "東海林",
      counterpartNumber: "090-4097-8843",
      counterpartName: "",
      talkSeconds: 79,
      talkTimeLabel: "1:19",
      hasRecording: true,
      inProgress: false,
      canPlay: true,
    },
    {
      id: "cdr-2",
      uniqid: "u2",
      startTime: "2026-10-09 09:01:00",
      displayTime: "09:01",
      type: "1",
      typeLabel: "着信",
      status: "3",
      statusLabel: "不在",
      circuitId: "line-2",
      circuitName: "代表",
      extension: "1003",
      employeeName: "東海林",
      counterpartNumber: "080-0000-0000",
      counterpartName: "",
      talkTimeLabel: "-",
      hasRecording: false,
      inProgress: false,
      canPlay: false,
    },
  ],
  counts: { total: 2, success: 1, missed: 1, inProgress: 0 },
  filterOptions: {
    employees: [{ label: "東海林", extensions: ["2040", "1003"] }],
    circuits: [{ value: "line-1", label: "トーカリのプロ" }],
  },
};

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/system/innovera-calls/line")) {
      return new Response(JSON.stringify({ ok: true, current: null, employee: null, circuits: [] }));
    }
    if (url.startsWith("/api/system/innovera-calls?")) {
      return new Response(JSON.stringify(callsPayload));
    }
    return new Response(JSON.stringify({ ok: false, error: "not found" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("InnoveraCallsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads today range by default and sends multiple extension params", async () => {
    const fetchMock = mockFetch();
    render(<InnoveraCallsClient access="all" ownExtension="2040" ownExtensions={["2040", "1003"]} role="cs" />);

    await screen.findByText(/通話 2 件/);
    const callUrl = String(fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/system/innovera-calls?"))?.[0]);
    expect(callUrl).toContain("from=");
    expect(callUrl).toContain("to=");
    expect(new URLSearchParams(callUrl.split("?")[1]).getAll("extension")).toEqual(["2040", "1003"]);
  });

  it("opens the employee multiselect and appends the selected extensions", async () => {
    const fetchMock = mockFetch();
    render(<InnoveraCallsClient access="all" ownExtension="2040" ownExtensions={["2040", "1003"]} role="cs" />);
    await screen.findByText(/通話 2 件/);

    // リストマスタと同じプルダウン：閉じた状態では「担当 東海林」（自分が既定で選ばれている）
    const picker = screen.getByRole("button", { name: /担当/ });
    expect(picker).toHaveTextContent("東海林");
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole("button", { name: "すべて外す" }));
    fireEvent.click(screen.getByLabelText(/東海林/));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "表示" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(before + 1));
    const callUrls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith("/api/system/innovera-calls?"));
    expect(new URLSearchParams(callUrls.at(-1)?.split("?")[1]).getAll("extension")).toEqual(["2040", "1003"]);
  });

  it("stops invalid ranges before fetching", async () => {
    const fetchMock = mockFetch();
    render(<InnoveraCallsClient access="own" ownExtension="2040" ownExtensions={["2040"]} role="cs" />);
    await screen.findByText(/通話 2 件/);
    const before = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText("開始"), { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByLabelText("終了"), { target: { value: "2026-10-08" } });
    fireEvent.click(screen.getByRole("button", { name: "表示" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("開始は終了より前にしてください");
    expect(fetchMock).toHaveBeenCalledTimes(before);
  });

  it("plays recordings in a modal and removes audio on close", async () => {
    mockFetch();
    render(<InnoveraCallsClient access="own" ownExtension="2040" ownExtensions={["2040"]} role="cs" />);
    await screen.findByText(/通話 2 件/);

    fireEvent.click(screen.getByRole("button", { name: "再生" }));
    const dialog = screen.getByRole("dialog", { name: "録音の再生" });
    expect(within(dialog).getByText(/090-4097-8843/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(dialog.querySelector("audio")).toHaveAttribute("controlsList", "nodownload");

    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
