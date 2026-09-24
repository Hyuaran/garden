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
    expect(screen.queryByRole("button", { name: /使い方/ })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "報告内容を送信する" }));

    expect(await screen.findByText("送信しました（Kintone にも記録しました）")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("【派遣先】NHK奈良"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "コピー" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("【日付】2026/09/24")));
  });
});
