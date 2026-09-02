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

  it("交通費は本人申告を読み取り表示し、上限から支給額を自動計算する", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.commute_routes = [{ kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "20,000", fare_oneway: "" }];
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByText("本人の申告（1か月定期代）")).toBeInTheDocument();
    expect(screen.getAllByText("20,000円").length).toBeGreaterThan(0);
    expect(screen.queryByText("交通費の確定額（1か月・円）")).toBeNull();
    expect(screen.getByText("上限以下なら申告額、超えたら上限")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "15,000" } });

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("15000");
  });

  it("本人申告が上限以下なら申告額を支給額にする", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.commute_routes = [{ kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "12,000", fare_oneway: "" }];
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "15,000" } });

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("12000");
  });

  it("上限が空なら支給額も空にする", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.commute_routes = [{ kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "20,000", fare_oneway: "" }];
    record.admin.commute_cap_monthly = "15,000";
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("15000");
    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "" } });

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("");
  });

  it("本人申告が無ければ未入力と表示し、上限を支給額にする", () => {
    const record = initialAdminRecord("EMP-001");
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getAllByText("未入力").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "15,000" } });

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("15000");
  });

  it("支給額を手で書き換えたあとは上限を変えてもそのままにする", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.commute_routes = [{ kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "20,000", fare_oneway: "" }];
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "15,000" } });
    fireEvent.change(screen.getByLabelText(/支給額（1か月・円）/), { target: { value: "14000" } });
    fireEvent.change(screen.getByLabelText("交通費の上限（1か月・円）"), { target: { value: "10,000" } });

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("14000");
  });

  it("未保存で画面を開いた直後は本人申告額を支給額へ勝手に入れず、空でも保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.commute_routes = [{ kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "20,000", fare_oneway: "" }];
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("");
    const saveButtons = screen.getAllByRole("button", { name: "保存" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.action).toBe("save");
    expect(body.values.commute_fixed_monthly).toBe("");
  });

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

    expect(screen.getByRole("heading", { name: "本人が入れた内容" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本人が入れた内容（読むだけ）" })).toBeNull();
    // 世帯主にも同じ見せ方が付いたので、メールアドレスの行だけを見る。
    const emailRow = screen.getByText("メールアドレス").closest("div") as HTMLElement;
    expect(within(emailRow).getByText("hy@example.jp")).toBeInTheDocument();
    expect(within(emailRow).getByRole("button", { name: "修正" })).toBeInTheDocument();
    expect(within(emailRow).getByText("事務が入れられます")).toBeInTheDocument();
  });

  it("メールアドレスをその行だけ修正して保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.email = "before@example.jp";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, email: "after@example.jp" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "メールアドレス" }), { target: { value: "after@example.jp" } });
    fireEvent.click(screen.getAllByRole("button", { name: "保存" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "email", email: "after@example.jp" });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
    expect(screen.getByText("after@example.jp")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "メールアドレス" })).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("メールアドレスの修正をやめると押す前の値に戻り保存しない", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.email = "before@example.jp";
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "メールアドレス" }), { target: { value: "changed@example.jp" } });
    fireEvent.click(screen.getAllByRole("button", { name: "やめる" })[0]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("before@example.jp")).toBeInTheDocument();
    expect(screen.queryByText("changed@example.jp")).toBeNull();
  });

  it("メールアドレスは空でも保存できる", async () => {
    const record = initialAdminRecord("EMP-001");
    record.values.email = "before@example.jp";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, email: "" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "メールアドレス" }), { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: "保存" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "email", email: "" });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "住所と連絡先" })).getAllByText("未入力").length).toBeGreaterThan(0);
  });

  it("メールアドレスの形がおかしいときは注意を出すが保存は止めない", async () => {
    const record = initialAdminRecord("EMP-001");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, email: "hy.example.jp" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "メールアドレス" }), { target: { value: "hy.example.jp" } });

    expect(screen.getByText("メールアドレスの形になっていません")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "保存" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "email", email: "hy.example.jp" });
  });

  it("メールアドレス保存に失敗したら入力中のまま理由を出す", async () => {
    const record = initialAdminRecord("EMP-001");
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "保存できませんでした。" }) });
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    fireEvent.change(screen.getByRole("textbox", { name: "メールアドレス" }), { target: { value: "after@example.jp" } });
    fireEvent.click(screen.getAllByRole("button", { name: "保存" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("保存できませんでした。");
    expect(screen.getByRole("textbox", { name: "メールアドレス" })).toHaveValue("after@example.jp");
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

    expect(screen.getByText("税務署名・市区町村名の欄は空欄です。手書きで足してください。")).toBeInTheDocument();
    expect(screen.queryByText("16歳未満のお子さんの欄は空欄です。")).toBeNull();
    expect(screen.queryByText(/世帯主・扶養親族の欄/)).toBeNull();
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

  it("入社連絡表の囲み、確認、やめるを画面内に出し、ブラウザ確認は使わない", () => {
    const record = initialAdminRecord("EMP-001");
    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getByRole("heading", { name: "入社連絡表（TLCC様提出用）" })).toBeInTheDocument();
    expect(screen.queryByText("扶養家族の欄はExcelのみ。PDFは空欄です。")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "入社連絡表を作る" }));

    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "入社連絡表の保存確認" })).toBeInTheDocument();
    expect(screen.getAllByText("マイナンバーが入った書類を、経理のフォルダに保存します。よろしいですか").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("group", { name: "入社連絡表の保存確認" })).toBeNull();
  });

  it("扶養控除申告書で入りきらない扶養家族がいるときは手書き案内を出す", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.dependents = [
      { name: "A", name_kana: "", my_number: "", relation: "子", birth_date: "2000-01-01", annual_income: "", occupation: "" },
      { name: "B", name_kana: "", my_number: "", relation: "子", birth_date: "2000-01-02", annual_income: "", occupation: "" },
      { name: "C", name_kana: "", my_number: "", relation: "子", birth_date: "2000-01-03", annual_income: "", occupation: "" },
      { name: "D", name_kana: "", my_number: "", relation: "子", birth_date: "2000-01-04", annual_income: "", occupation: "" },
      { name: "E", name_kana: "", my_number: "", relation: "子", birth_date: "2007-01-01", annual_income: "", occupation: "" },
      { name: "F", name_kana: "", my_number: "", relation: "子", birth_date: "2011-01-02", annual_income: "", occupation: "" },
    ];

    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getAllByText("1人分は用紙に入りきらないため手書きで足してください").length).toBeGreaterThan(0);
  });

  it("扶養控除申告書で16歳未満が3人以上ならあふれ分の手書き案内を出す", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.dependents = [
      { name: "A", name_kana: "", my_number: "", relation: "子", birth_date: "2011-01-02", annual_income: "", occupation: "" },
      { name: "B", name_kana: "", my_number: "", relation: "子", birth_date: "2012-01-01", annual_income: "", occupation: "" },
      { name: "C", name_kana: "", my_number: "", relation: "子", birth_date: "2013-01-01", annual_income: "", occupation: "" },
    ];

    render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getAllByText("1人分は用紙に入りきらないため手書きで足してください").length).toBeGreaterThan(0);
  });

  it("入社連絡表で扶養家族が5人以上なら手書き案内を出し、4人以内なら出さない", () => {
    const record = initialAdminRecord("EMP-001");
    record.values.dependents = [
      { name: "A", name_kana: "", my_number: "", relation: "子", birth_date: "2011-01-01", annual_income: "", occupation: "" },
      { name: "B", name_kana: "", my_number: "", relation: "子", birth_date: "2010-01-01", annual_income: "", occupation: "" },
      { name: "C", name_kana: "", my_number: "", relation: "子", birth_date: "2009-01-01", annual_income: "", occupation: "" },
      { name: "D", name_kana: "", my_number: "", relation: "子", birth_date: "2008-01-01", annual_income: "", occupation: "" },
    ];
    const { rerender } = render(<OnboardingAdminDetailClient record={record} />);

    expect(screen.queryByText(/用紙に入りきらないため手書きで足してください/)).toBeNull();

    record.values.dependents = [
      ...record.values.dependents,
      { name: "E", name_kana: "", my_number: "", relation: "子", birth_date: "2000-01-05", annual_income: "", occupation: "" },
    ];
    rerender(<OnboardingAdminDetailClient record={record} />);

    expect(screen.getAllByText("1人分は用紙に入りきらないため手書きで足してください").length).toBeGreaterThan(0);
    expect(screen.queryByText("扶養家族の欄はExcelのみ。PDFは空欄です。")).toBeNull();
  });

  it("入社連絡表の保存成功と失敗を画面内に日本語で出す", async () => {
    const record = initialAdminRecord("EMP-001");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, xlsxFilename: "01【提出用ヨシダヒナ】TLCC様入社連絡表.xlsx", pdfFilename: "01【提出用ヨシダヒナ】TLCC様入社連絡表.pdf", folderLabel: "経理部 ／ 30_入社連絡票" }) });
    const { rerender } = render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "入社連絡表を作る" }));
    fireEvent.click(screen.getByRole("button", { name: "作って保存する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: "renrakuhyo" });
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    expect(screen.getByText("01【提出用ヨシダヒナ】TLCC様入社連絡表.xlsx")).toBeInTheDocument();
    expect(screen.getByText("01【提出用ヨシダヒナ】TLCC様入社連絡表.pdf")).toBeInTheDocument();
    expect(screen.getByText("経理部 ／ 30_入社連絡票 に入っています")).toBeInTheDocument();

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "保存先のフォルダに書き込めませんでした。" }) });
    rerender(<OnboardingAdminDetailClient record={record} />);
    fireEvent.click(screen.getByRole("button", { name: "入社連絡表を作る" }));
    fireEvent.click(screen.getByRole("button", { name: "作って保存する" }));

    expect(await screen.findByText("保存先のフォルダに書き込めませんでした。")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Drive API|token|scope/i);
  });
});
