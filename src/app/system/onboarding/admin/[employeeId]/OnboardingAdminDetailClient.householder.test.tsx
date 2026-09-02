import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
import { initialAdminRecord } from "../../_lib/onboarding-admin";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("事務詳細の世帯主編集", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refresh.mockClear();
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("世帯主の氏名をレビュー行で修正して保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.householder_name = "変更前";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, householderName: "吉田 陽菜" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名を修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "世帯主の氏名" }), { target: { value: "吉田 陽菜" } });
    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "householder", householderName: "吉田 陽菜" });
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    expect(screen.getByText("吉田 陽菜")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("世帯主との続柄を選択して保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.householder_relation = "父";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, householderRelation: "本人" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "世帯主との続柄を修正" }));
    fireEvent.change(screen.getByRole("combobox", { name: "世帯主との続柄" }), { target: { value: "本人" } });
    fireEvent.click(screen.getByRole("button", { name: "世帯主との続柄を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "householder", householderRelation: "本人" });
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    expect(screen.getByText("本人")).toBeInTheDocument();
  });

  it("やめるで元の値に戻り、空欄でも保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.householder_name = "変更前";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, householderName: "" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名を修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "世帯主の氏名" }), { target: { value: "保存しない" } });
    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名の修正をやめる" }));
    expect(screen.getByText("変更前")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名を修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "世帯主の氏名" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "世帯主の氏名を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "householder", householderName: "" });
    await waitFor(() => expect(screen.getAllByText("未入力").length).toBeGreaterThan(0));
  });
});
