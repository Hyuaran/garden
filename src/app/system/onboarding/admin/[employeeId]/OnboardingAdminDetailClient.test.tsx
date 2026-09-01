import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
import { initialAdminRecord } from "../../_lib/onboarding-admin";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("入社手続きの事務詳細", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refresh.mockClear();
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    confirmMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("従業員台帳への反映確認を画面内に出し、ブラウザ確認は使わない", async () => {
    const record = initialAdminRecord("EMP-001");
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "従業員台帳に反映する" }));
    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "従業員台帳への反映確認" })).toBeInTheDocument();
    expect(screen.getByText("従業員台帳に反映します。よろしいですか")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("group", { name: "従業員台帳への反映確認" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "従業員台帳に反映する" }));
    fireEvent.click(screen.getByRole("button", { name: "反映する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.action).toBe("apply");
    expect(confirmMock).not.toHaveBeenCalled();
  });
  it("読むだけの詳細にメールアドレスを表示する", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.email = "hy@example.jp";
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByText("hy@example.jp")).toBeInTheDocument();
  });

  it("マイナンバーは初期HTMLに全桁を持たず、見る/隠すで取得表示する", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.my_number = "••••••••5540";
    record.values.dependents = [{ name: "家族", name_kana: "", my_number: "••••••••3333", relation: "子", birth_date: "", annual_income: "", occupation: "" }];
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, myNumber: "123456785540" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    expect(document.body.textContent).toContain("••••••••5540");
    expect(document.body.textContent).not.toContain("123456785540");
    fireEvent.click(within(screen.getByRole("region", { name: "マイナンバー" })).getByRole("button", { name: "見る" }));

    expect(await screen.findByText("123456785540")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "myNumber", target: { kind: "self" } });
    fireEvent.click(screen.getByRole("button", { name: "隠す" }));
    expect(screen.queryByText("123456785540")).toBeNull();
    expect(screen.getByText("••••••••5540")).toBeInTheDocument();
  });

  it("扶養家族のマイナンバーも押したときだけ取得する", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.dependents = [{ name: "家族", name_kana: "", my_number: "••••••••3333", relation: "子", birth_date: "", annual_income: "", occupation: "" }];
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, myNumber: "111122223333" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "見る" }));

    expect(await screen.findByText("111122223333")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "myNumber", target: { kind: "dependent", index: 0 } });
  });

  it("扶養控除申告書の確認を画面内に出し、やめるで戻る", () => {
    const record = initialAdminRecord("EMP-001");
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByText("税務署名・市区町村名・世帯主・扶養親族の欄は空欄です。手書きで足してください。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "扶養控除申告書を作る" }));

    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "扶養控除申告書の保存確認" })).toBeInTheDocument();
    expect(screen.getByText("マイナンバーが入った書類を、経理のフォルダに保存します。よろしいですか")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("group", { name: "扶養控除申告書の保存確認" })).toBeNull();
  });

  it("扶養控除申告書の保存成功と失敗を画面内に日本語で出す", async () => {
    const record = initialAdminRecord("EMP-001");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, filename: "【扶養控除申告書】上田基人_令和8年分_給与所得者の扶養控除等(異動)申告書.pdf", folderLabel: "経理部 ／ 12_扶養控除申告書" }) });
    const { rerender } = render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "扶養控除申告書を作る" }));
    fireEvent.click(screen.getByRole("button", { name: "作って保存する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "fuyou" });
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    expect(screen.getByText("経理部 ／ 12_扶養控除申告書 に入っています")).toBeInTheDocument();

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。" }) });
    rerender(<OnboardingAdminDetailClient record={record} />);
    fireEvent.click(screen.getByRole("button", { name: "扶養控除申告書を作る" }));
    fireEvent.click(screen.getByRole("button", { name: "作って保存する" }));

    expect(await screen.findByText("保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Drive API|token|scope/i);
  });
});
