import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NhkVisitClient from "./NhkVisitClient";

describe("NhkVisitClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  // 使い方は画面に書かず、画像つきのマニュアル①へ送る（2026-09-24）
  it("links to the illustrated guide", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true, reports: [] }));
    render(<NhkVisitClient submitterName="東海林 美琴" employeeNumber="1234" />);
    await screen.findByText("まだありません");

    expect(screen.getByRole("link", { name: "使い方ガイドを見る" })).toHaveAttribute("href", "/system/manuals/system/nhk-visit?tab=operation");
    expect(screen.getByRole("button", { name: "この画面の使い方" })).toBeInTheDocument();
  });

  it("updates totals with plus and minus buttons", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true, reports: [] }));
    render(<NhkVisitClient submitterName="東海林 美琴" employeeNumber="1234" />);

    fireEvent.click(screen.getAllByRole("button", { name: "地上を増やす" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "衛星を増やす" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "衛星を減らす" })[0]);

    expect(screen.getByText((_content, element) => element?.tagName === "P" && (element.textContent?.includes("新規　計") ?? false))).toHaveTextContent("1");
  });

  it("shows the report message and copy button after submit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        return Response.json({
          ok: true,
          kintoneStatus: "synced",
          message: [
            "【日付】2026/09/24",
            "【時間】09:30〜18:00",
            "【派遣先】NHK奈良",
            "【業務】対面アプローチ",
            "【成約件数】",
            "　■新規　1件（地上1件、衛星0件）",
            "　■住所変更　0件（地上0件、衛星0件）",
            "　■再開　解決1件、収納2口",
            "　■口座・クレ　0件",
            "【交通費】あり",
          ].join("\n"),
        });
      }
      return Response.json({ ok: true, reports: [] });
    });

    render(<NhkVisitClient submitterName="東海林 美琴" employeeNumber="1234" />);
    await screen.findByText("まだありません");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NHK奈良" } });
    fireEvent.click(screen.getAllByRole("button", { name: "地上を増やす" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "解決を増やす" }));
    fireEvent.click(screen.getByRole("button", { name: "収納を増やす" }));
    fireEvent.click(screen.getByRole("button", { name: "収納を増やす" }));
    fireEvent.click(screen.getByRole("button", { name: "報告内容を送信する" }));

    expect(await screen.findByText("送信しました（Kintone にも記録しました）")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ resumeResolved: 1, resumeCollected: 2 });
    expect(screen.getByText((content) => content.includes("■再開 解決1件、収納2口"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "コピー" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("【日付】2026/09/24")));
  });

  it("shows resume counts in recent history and defaults legacy reports to zero", async () => {
    const row = { visit_date: "2026-09-24", start_time: "09:30", end_time: "18:00", destination: "NHK奈良", transport_fee: "あり" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      ok: true,
      reports: [{ ...row, id: "new", resume_resolved: 2, resume_collected: 3 }, { ...row, id: "old" }],
    }));
    render(<NhkVisitClient submitterName="東海林 美琴" employeeNumber="1234" />);

    expect(await screen.findByText(/住所0・再開 解決2\/収納3・口座0/)).toBeInTheDocument();
    expect(screen.getByText(/住所0・再開 解決0\/収納0・口座0/)).toBeInTheDocument();
  });

  it("uses the same submit endpoint in mobile view without breadcrumbs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        return Response.json({ ok: true, kintoneStatus: "queued", message: "送信内容" });
      }
      return Response.json({ ok: true, reports: [] });
    });

    render(<NhkVisitClient submitterName="桐井 大輔" employeeNumber="5678" mobile />);
    await screen.findByText("まだありません");

    expect(screen.queryByRole("navigation", { name: "現在地" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NHK訪問業務 報告" })).toBeInTheDocument();
    expect(screen.getByText("桐井 大輔 さん")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "再開" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NHK大阪" } });
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));

    await screen.findByText("送信しました（Kintone は後で送り直します）");
    expect(fetchMock).toHaveBeenCalledWith("/api/system/nhk-visit", expect.objectContaining({ method: "POST" }));
  });
});
