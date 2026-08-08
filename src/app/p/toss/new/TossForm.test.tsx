import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_components/PartnerGate", () => ({
  usePartnerSession: () => ({ kind: "staff" }),
}));

import TossForm from "./TossForm";

describe("TossForm conditional UI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hides and clears cashback and PD fields", () => {
    render(<TossForm />);
    expect(screen.queryByLabelText("キャッシュバック金額")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("キャッシュバック有無"), { target: { value: "利用する" } });
    fireEvent.change(screen.getByLabelText("キャッシュバック金額"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("キャッシュバック有無"), { target: { value: "利用しない" } });
    fireEvent.change(screen.getByLabelText("キャッシュバック有無"), { target: { value: "利用する" } });
    expect(screen.getByLabelText("キャッシュバック金額")).toHaveValue(null);

    fireEvent.change(screen.getByLabelText(/PD管理番号/), { target: { value: "1234567" } });
    fireEvent.change(screen.getByLabelText("関電リスト区分"), { target: { value: "リスト外" } });
    expect(screen.queryByLabelText(/PD管理番号/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "照合" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("関電リスト区分"), { target: { value: "リスト内" } });
    expect(screen.getByLabelText(/PD管理番号/)).toHaveValue("");
  });

  it("shows the processing overlay and lookup result modal", async () => {
    let resolveLookup!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/toss/kanden-lookup")) return new Promise(resolve => { resolveLookup = resolve; });
      return Promise.resolve({ ok: true, json: async () => ({ found: true, data: { prefecture: "大阪府", city: "大阪市", town: "北区" } }) });
    }));
    render(<TossForm />);
    fireEvent.change(screen.getByLabelText(/PD管理番号/), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "照合" }));
    expect(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();

    resolveLookup({ ok: true, json: async () => ({ found: false }) });
    expect(await screen.findByRole("dialog")).toHaveTextContent("一致するリストがありませんので、再度確認してください。");
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("fills an address silently and reports only address failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ found: true, data: { prefecture: "兵庫県", city: "神戸市", town: "中央区" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ found: false }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TossForm />);
    fireEvent.change(screen.getByLabelText(/郵便番号/), { target: { value: "6500000" } });
    fireEvent.click(screen.getByRole("button", { name: "住所検索" }));
    await waitFor(() => expect(screen.getByLabelText(/都道府県/)).toHaveValue("兵庫県"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "住所検索" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("住所が見つかりませんでした");
  });

  it("uses the overlay for submission and reports submission failures in the modal", async () => {
    let resolveSubmit!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { resolveSubmit = resolve; })));
    render(<TossForm />);
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();
    resolveSubmit({ ok: false, json: async () => ({ error: "送信できませんでした" }) });
    expect(await screen.findByRole("dialog")).toHaveTextContent("送信できませんでした");
    expect(screen.queryByRole("status", { name: "処理中" })).not.toBeInTheDocument();
  });

  it("keeps the existing completion screen after a successful submission", async () => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ recordId: "DEMO", demo: true }) }));
    render(<TossForm />);
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("heading", { name: "送信が完了しました" })).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("デモ送信：実際には登録されていません")).toBeInTheDocument();
  });
});
