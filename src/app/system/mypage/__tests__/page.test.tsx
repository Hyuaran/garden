import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace:vi.fn(), refresh:vi.fn(), signOut:vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter:()=>({replace:mocks.replace,refresh:mocks.refresh}) }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient:()=>({auth:{signOut:mocks.signOut}}) }));
vi.mock("../../attendance/AttendanceClient", () => ({ default:(props:unknown)=><div data-testid="attendance-client">{JSON.stringify(props)}</div> }));
import MyPageClient from "../MyPageClient";
import type { MyPageProfile } from "../types";

const profile: MyPageProfile = { name:"社員A", nameKana:"シャインエー", employeeNumber:"001", employmentType:"正社員", birthday:"1980-08-13", email:"a@example.com", gardenRole:"staff" };
const baseProps = { initialTab:"profile" as const, registered:true, employeeName:"社員A", canViewSync:false, birthdayRegistered:true, initialProfile:null };

describe("system mypage", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); mocks.replace.mockReset(); });
  it("renders four tabs in the fixed order and only the gate before unlock", () => {
    render(<MyPageClient {...baseProps}/>);
    expect(screen.getAllByRole("tab").map((tab)=>tab.textContent)).toEqual(["マイページ","勤怠打刻","シフト","前確依頼"]);
    expect(screen.getByLabelText("本人確認")).toBeInTheDocument();
    expect(screen.queryByText("基本情報")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("1234");
    expect(document.body.textContent).not.toContain(profile.birthday);
  });
  it("opens tabs 2 to 4 without the four-digit check", () => {
    render(<MyPageClient {...baseProps}/>);
    fireEvent.click(screen.getByRole("tab",{name:"勤怠打刻"}));
    expect(screen.getByTestId("attendance-client")).toHaveTextContent(JSON.stringify({registered:true,employeeName:"社員A",canViewSync:false,embedded:true}));
    fireEvent.click(screen.getByRole("tab",{name:"シフト"})); expect(screen.getByText(/シフトの提出・確認/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"前確依頼"})); expect(screen.getByRole("button",{name:"連携チェック"})).toBeInTheDocument();
  });
  it("uses the attendance query tab as the initial tab", () => {
    render(<MyPageClient {...baseProps} initialTab="attendance" canViewSync/>);
    expect(screen.getByRole("tab",{name:"勤怠打刻"})).toHaveAttribute("aria-selected","true");
    expect(screen.getByTestId("attendance-client")).toHaveTextContent('"canViewSync":true');
  });
  it("reveals only the profile returned after a correct unlock", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,profile}),{status:200})));
    render(<MyPageClient {...baseProps}/>);
    fireEvent.change(screen.getByLabelText("生年月日の月日4桁"),{target:{value:"0813"}});
    fireEvent.click(screen.getByRole("button",{name:"認証してマイページを開く"}));
    expect(await screen.findByText("社員A")).toBeInTheDocument();
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(requestBody).toEqual({code:"0813"});
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"シフト"}));
    fireEvent.click(screen.getByRole("tab",{name:"マイページ"}));
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bypasses the gate with an explanation when birthday is missing", () => {
    render(<MyPageClient {...baseProps} birthdayRegistered={false} initialProfile={{...profile,birthday:null}}/>);
    expect(screen.queryByLabelText("本人確認")).not.toBeInTheDocument();
    expect(screen.getByText("生年月日が未登録のため本人確認を省略しています。")).toBeInTheDocument();
  });
  it("marks every dummy area as preparing", () => {
    render(<MyPageClient {...baseProps} birthdayRegistered={false} initialProfile={{...profile,birthday:null}}/>);
    expect(screen.getByRole("heading",{name:/緊急連絡先/})).toHaveTextContent("準備中");
    expect(screen.getByRole("heading",{name:/パフォーマンス推移/})).toHaveTextContent("準備中");
    const basic = screen.getByRole("heading",{name:"基本情報"}).closest("section")!;
    expect(within(basic).getByText("交通費").parentElement).toHaveTextContent("準備中");
    expect(screen.getByText("通知音").parentElement).toHaveTextContent("準備中");
  });
  it("keeps the existing 90-day localStorage confirmation key", async () => {
    render(<MyPageClient {...baseProps} birthdayRegistered={false} initialProfile={{...profile,birthday:null}}/>);
    const button = await screen.findByRole("button",{name:"変更はありません"}); fireEvent.click(button);
    await waitFor(()=>expect(localStorage.getItem("gardenTree_mypageLastConfirm")).toMatch(/^\d{4}-/));
    expect(screen.queryByLabelText("個人情報の定期確認")).not.toBeInTheDocument();
  });
});
