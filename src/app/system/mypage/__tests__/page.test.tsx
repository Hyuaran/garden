import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("../../attendance/AttendanceClient", () => ({
  default: (props: unknown) => (
    <div data-testid="attendance-client">{JSON.stringify(props)}</div>
  ),
}));
import MyPageClient from "../MyPageClient";
import type { MyPageProfile } from "../types";

const profile: MyPageProfile = {
  name: "社員A",
  nameKana: "シャインエー",
  employeeNumber: "001",
  employmentType: "正社員",
  birthday: "1980-08-13",
  email: "a@example.com",
  gardenRole: "staff",
  bankName: "みどり銀行",
  branchName: "庭園支店",
  commuteDailyAllowance: 800,
  commuteMonthlyCap: 20000,
  mynaSubmitted: true,
};
const baseProps = {
  initialTab: "profile" as const,
  tabbed: true,
  registered: true,
  employeeName: "社員A",
  canViewSync: false,
  birthdayRegistered: true,
  initialProfile: null,
};
const renderMyPage = (props: ComponentProps<typeof MyPageClient> = baseProps) =>
  render(<MyPageClient {...props} />);

describe("system mypage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
    mocks.replace.mockReset();
  });
  it("renders four tabs in the fixed order and only the gate before unlock", () => {
    renderMyPage();
    expect(screen.getByText("System ／ マイページ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "マイページ" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "マイページ",
      "勤怠打刻",
      "シフト",
      "前確依頼",
    ]);
    expect(screen.getByLabelText("個人情報を開く")).toBeInTheDocument();
    const unlockCode = screen.getByLabelText("誕生日の月日4桁");
    expect(unlockCode).toHaveAttribute("placeholder", "誕生日を入力　例：12/1の場合1201");
    expect(unlockCode).toHaveAttribute("type", "text");
    expect(unlockCode).toHaveAttribute("autocomplete", "one-time-code");
    expect(unlockCode).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: "マイページを開く" })).toBeInTheDocument();
    expect(screen.queryByText("本人確認")).not.toBeInTheDocument();
    expect(screen.queryByText("生年月日の月日4桁")).not.toBeInTheDocument();
    expect(screen.queryByText("認証してマイページを開く")).not.toBeInTheDocument();
    expect(screen.queryByText("基本情報")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("1234");
    expect(document.body.textContent).not.toContain(profile.birthday);
  });
  it("shows only the requested function in standalone mode", () => {
    renderMyPage({ ...baseProps, tabbed: false });
    expect(screen.getByText("System ／ 自分の情報")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "自分の情報" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByLabelText("誕生日の月日4桁")).toBeInTheDocument();
  });
  it.each([
    ["attendance", "勤怠打刻"],
    ["shift", "シフト"],
    ["zenkaku", "前確依頼"],
  ] as const)("shows standalone %s without profile verification", (initialTab, title) => {
    renderMyPage({ ...baseProps, initialTab, tabbed: false });
    expect(screen.getByText(`System ／ ${title}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("誕生日の月日4桁")).not.toBeInTheDocument();
  });
  it("leaves theme switching and logout to ShachoShell", () => {
    renderMyPage();
    expect(screen.queryByRole("button", { name: /ダークにする|ライトにする/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
  });
  it("opens tabs 2 to 4 without the four-digit check", () => {
    renderMyPage();
    fireEvent.click(screen.getByRole("tab", { name: "勤怠打刻" }));
    expect(screen.getByTestId("attendance-client")).toHaveTextContent(
      JSON.stringify({
        registered: true,
        employeeName: "社員A",
        canViewSync: false,
        embedded: true,
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "シフト" }));
    expect(screen.getByText(/シフトの提出・確認/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "前確依頼" }));
    expect(
      screen.getByRole("button", { name: "連携チェック" }),
    ).toBeInTheDocument();
    expect(mocks.replace.mock.calls.map(([path]) => path)).toEqual([
      "/system/attendance", "/system/shift", "/system/zenkaku",
    ]);
  });
  it("uses the attendance route as the initial tab", () => {
    renderMyPage({ ...baseProps, initialTab: "attendance", canViewSync: true });
    expect(screen.getByRole("tab", { name: "勤怠打刻" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("attendance-client")).toHaveTextContent(
      '"canViewSync":true',
    );
  });
  it("reveals only the profile returned after a correct unlock", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true, profile }), { status: 200 }),
        ),
    );
    renderMyPage();
    fireEvent.change(screen.getByLabelText("誕生日の月日4桁"), {
      target: { value: "0813" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "マイページを開く" }),
    );
    expect(await screen.findByText("社員A")).toBeInTheDocument();
    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0][1]?.body),
    );
    expect(requestBody).toEqual({ code: "0813" });
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "シフト" }));
    fireEvent.click(screen.getByRole("tab", { name: "マイページ" }));
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => url === "/api/system/mypage/unlock"),
    ).toHaveLength(1);
  });
  it("rejects an incorrect four-digit keyword as before", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok:false }), { status:401 })));
    renderMyPage();
    fireEvent.change(screen.getByLabelText("誕生日の月日4桁"), { target:{ value:"9999" } });
    fireEvent.click(screen.getByRole("button", { name:"マイページを開く" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("4桁が一致しません。");
    expect(screen.queryByText("基本情報")).not.toBeInTheDocument();
  });
  it("bypasses the gate with an explanation when birthday is missing", () => {
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: { ...profile, birthday: null },
    });
    expect(screen.queryByLabelText("個人情報を開く")).not.toBeInTheDocument();
    expect(
      screen.getByText("生年月日が未登録のため確認を省略しています。"),
    ).toBeInTheDocument();
  });
  it("shows safe profile details and replaces dummy areas with preview cards", () => {
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: { ...profile, birthday: null },
    });
    expect(
      screen.getByText(
        "緊急連絡先の登録・確認がマイページでできるようになります",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "架電数・有効率・順位の6ヶ月推移がここで見られるようになります",
      ),
    ).toBeInTheDocument();
    const basic = screen
      .getByRole("heading", { name: "基本情報" })
      .closest("section")!;
    expect(within(basic).getByText("交通費").parentElement).toHaveTextContent(
      "日額 800円（月の上限 20,000円）",
    );
    expect(
      within(basic).getByText("給与受取口座").parentElement,
    ).toHaveTextContent("みどり銀行 庭園支店");
    expect(
      within(basic).getByText("マイナンバー").parentElement,
    ).toHaveTextContent("提出済み");
    expect(
      screen.queryByRole("heading", { name: "設定" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("通知音")).not.toBeInTheDocument();
    expect(screen.queryByText("パスワード変更")).not.toBeInTheDocument();
    for (const label of ["緊急連絡先変更", "通勤経路変更", "給与受取口座の変更", "退職届", "秘密保持誓約書"])
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
  it("uses Japanese fallback labels for unregistered private profile data", () => {
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: {
        ...profile,
        birthday: null,
        bankName: null,
        branchName: null,
        commuteDailyAllowance: null,
        commuteMonthlyCap: null,
        mynaSubmitted: false,
      },
    });
    const basic = screen
      .getByRole("heading", { name: "基本情報" })
      .closest("section")!;
    expect(within(basic).getByText("交通費").parentElement).toHaveTextContent(
      "未登録",
    );
    expect(
      within(basic).getByText("給与受取口座").parentElement,
    ).toHaveTextContent("未登録");
    expect(
      within(basic).getByText("マイナンバー").parentElement,
    ).toHaveTextContent("未提出");
  });
  it("submits the expanded emergency contact payload with the employee name read-only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, rows: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: { ...profile, birthday: null },
    });
    fireEvent.click(screen.getByRole("button", { name: /緊急連絡先変更/ }));
    expect(screen.getByLabelText("提出者本人の氏名")).toHaveValue("社員A");
    expect(screen.getByLabelText("提出者本人の氏名")).toHaveAttribute(
      "readonly",
    );
    for (const [label, value] of [
      ["現住所", "東京都"],
      ["個人の電話番号（携帯等）", "090"],
      ["緊急連絡先の氏名", "家族A"],
      ["本人との続柄", "母"],
      ["緊急連絡先の住所（同一の場合は「同上」）", "同上"],
      ["緊急連絡先の電話番号", "080"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, id: "1" }), { status: 201 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/system/mypage/submissions",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/system/mypage/submissions" && init?.method === "POST",
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      type: "emergency_contact",
      payload: {
        kind: "new",
        selfAddress: "東京都",
        selfPhone: "090",
        ecName: "家族A",
        ecRelationship: "母",
        ecAddress: "同上",
        ecPhone: "080",
      },
    });
  });
  it("shows and submits the full NDA fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, rows: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: { ...profile, birthday: null },
    });
    fireEvent.click(screen.getByRole("button", { name: /秘密保持誓約書/ }));
    expect(screen.getByText(/第6条 損害賠償/)).toBeInTheDocument();
    expect((screen.getByLabelText("誓約日") as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    fireEvent.click(screen.getByLabelText("再提出"));
    fireEvent.change(screen.getByLabelText("住所"), {
      target: { value: "東京都" },
    });
    fireEvent.change(screen.getByLabelText("氏名（電子署名）"), {
      target: { value: "社員A" },
    });
    fireEvent.click(screen.getByLabelText("内容に同意します"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, id: "nda-1" }), { status: 201 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "送信する" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/system/mypage/submissions",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/system/mypage/submissions" && init?.method === "POST",
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      type: "nda",
      payload: expect.objectContaining({
        kind: "resubmit",
        pledgeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        address: "東京都",
        signature: "社員A",
        agreed: true,
      }),
    });
  });
  it("keeps the existing 90-day localStorage confirmation key", async () => {
    renderMyPage({
      ...baseProps,
      birthdayRegistered: false,
      initialProfile: { ...profile, birthday: null },
    });
    const button = await screen.findByRole("button", {
      name: "変更はありません",
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(localStorage.getItem("gardenTree_mypageLastConfirm")).toMatch(
        /^\d{4}-/,
      ),
    );
    expect(
      screen.queryByLabelText("個人情報の定期確認"),
    ).not.toBeInTheDocument();
  });
});
