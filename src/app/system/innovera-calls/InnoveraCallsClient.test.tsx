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

type LineMock = { current: unknown; circuits: unknown[]; postOk?: boolean };

function mockFetch(line?: LineMock) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/system/innovera-calls/line")) {
      if (init?.method === "POST") {
        if (line?.postOk === false) return new Response(JSON.stringify({ ok: false, error: "発信番号を変更できませんでした" }), { status: 500 });
        const body = JSON.parse(String(init.body ?? "{}")) as { circuitId?: string };
        const next = (line?.circuits ?? []).find((item) => (item as { id: string }).id === body.circuitId) ?? null;
        return new Response(JSON.stringify({ ok: true, current: next }));
      }
      return new Response(JSON.stringify({ ok: true, current: line?.current ?? null, employee: null, circuits: line?.circuits ?? [] }));
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
    // 既定＝全員（担当を送らない）
    expect(new URLSearchParams(callUrl.split("?")[1]).getAll("extension")).toEqual([]);
  });

  it("opens the employee multiselect and appends the selected extensions", async () => {
    const fetchMock = mockFetch();
    render(<InnoveraCallsClient access="all" ownExtension="2040" ownExtensions={["2040", "1003"]} role="cs" />);
    await screen.findByText(/通話 2 件/);

    // リストマスタと同じプルダウン：閉じた状態では「担当 全員」（既定は何も選ばない＝全員）
    const picker = screen.getByRole("button", { name: /担当/ });
    expect(picker).toHaveTextContent("全員");
    fireEvent.click(picker);
    expect(screen.queryByText(/表示中の期間の通話数/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/東海林/));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "表示" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(before + 1));
    const callUrls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith("/api/system/innovera-calls?"));
    expect(new URLSearchParams(callUrls.at(-1)?.split("?")[1]).getAll("extension")).toEqual(["2040", "1003"]);
  });

  const lineA = { id: "c-1", name: "【ARATAキャリア】0120-402-347", number: "0120402347", freeNumber: "0120402347", circuitNum: "001" };
  const lineB = { id: "c-2", name: "【代表ヒュアラン】06-4400-5414", number: "0644005414", freeNumber: "", circuitNum: "007" };

  it("changes the outbound line through the Garden modal: confirm, working, done", async () => {
    mockFetch({ current: lineA, circuits: [lineA, lineB] });
    render(<InnoveraCallsClient access="all" ownExtension="2001" ownExtensions={["2001"]} ownName="東海林" role="super_admin" />);
    await screen.findAllByText(/【ARATAキャリア】/);

    const lineSelect = screen.getAllByRole("combobox").find((element) => Array.from((element as HTMLSelectElement).options).some((option) => option.value === "c-2")) as HTMLSelectElement;
    fireEvent.change(lineSelect, { target: { value: "c-2" } });
    fireEvent.click(screen.getByRole("button", { name: "変更する" }));
    const dialog = await screen.findByRole("dialog", { name: "発信番号の変更" });
    expect(within(dialog).getByText("現状").nextElementSibling).toHaveTextContent("【ARATAキャリア】0120-402-347");
    expect(within(dialog).getByText("変更後").nextElementSibling).toHaveTextContent("【代表ヒュアラン】06-4400-5414");
    expect(dialog).toHaveTextContent("変更しますが、本当によろしいですか？");
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "変更する" }));
    await screen.findByText("変更しました：【代表ヒュアラン】06-4400-5414");
    // 自動では閉じない（1.5 秒待っても出たまま）→「閉じる」で閉じる
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.getByRole("dialog", { name: "発信番号の変更" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "閉じる" }).at(-1) as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "発信番号の変更" })).not.toBeInTheDocument());
    expect(screen.getAllByText(/【代表ヒュアラン】06-4400-5414/).length).toBeGreaterThan(0);
  });

  it("shows the failure inside the modal and lets the user retry", async () => {
    mockFetch({ current: lineA, circuits: [lineA, lineB], postOk: false });
    render(<InnoveraCallsClient access="all" ownExtension="2001" ownExtensions={["2001"]} ownName="東海林" role="super_admin" />);
    await screen.findAllByText(/【ARATAキャリア】/);
    const lineSelect = screen.getAllByRole("combobox").find((element) => Array.from((element as HTMLSelectElement).options).some((option) => option.value === "c-2")) as HTMLSelectElement;
    fireEvent.change(lineSelect, { target: { value: "c-2" } });
    fireEvent.click(screen.getByRole("button", { name: "変更する" }));
    const dialog = await screen.findByRole("dialog", { name: "発信番号の変更" });
    fireEvent.click(within(dialog).getByRole("button", { name: "変更する" }));
    const alert = await within(dialog).findByRole("alert");
    // 失敗文はモーダルの中だけ（回線名の下に二重に出さない）
    expect(screen.getAllByText(alert.textContent as string)).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "もう一度" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "閉じる" }).at(-1) as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "発信番号の変更" })).not.toBeInTheDocument();
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
