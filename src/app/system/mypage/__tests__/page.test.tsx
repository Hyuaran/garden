import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({ replace:vi.fn(), refresh:vi.fn(), signOut:vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter:()=>({replace:mocks.replace,refresh:mocks.refresh}) }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient:()=>({auth:{signOut:mocks.signOut}}) }));
vi.mock("../../attendance/AttendanceClient", () => ({ default:(props:unknown)=><div data-testid="attendance-client">{JSON.stringify(props)}</div> }));
import MyPageClient from "../MyPageClient";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";
import type { MyPageProfile } from "../types";

const profile: MyPageProfile = { name:"社員A", nameKana:"シャインエー", employeeNumber:"001", employmentType:"正社員", birthday:"1980-08-13", email:"a@example.com", gardenRole:"staff",bankName:"みどり銀行",branchName:"庭園支店",commuteDailyAllowance:800,commuteMonthlyCap:20000,mynaSubmitted:true };
const baseProps = { initialTab:"profile" as const, registered:true, employeeName:"社員A", canViewSync:false, birthdayRegistered:true, initialProfile:null };
const renderMyPage = (props:ComponentProps<typeof MyPageClient>=baseProps) => render(<ThemeProvider><MyPageClient {...props}/></ThemeProvider>);

describe("system mypage", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); document.documentElement.classList.remove("dark"); vi.restoreAllMocks(); mocks.replace.mockReset(); });
  it("renders four tabs in the fixed order and only the gate before unlock", () => {
    renderMyPage();
    expect(screen.getAllByRole("tab").map((tab)=>tab.textContent)).toEqual(["マイページ","勤怠打刻","シフト","前確依頼"]);
    expect(screen.getByLabelText("本人確認")).toBeInTheDocument();
    expect(screen.queryByText("基本情報")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("1234");
    expect(document.body.textContent).not.toContain(profile.birthday);
  });
  it("opens tabs 2 to 4 without the four-digit check", () => {
    renderMyPage();
    fireEvent.click(screen.getByRole("tab",{name:"勤怠打刻"}));
    expect(screen.getByTestId("attendance-client")).toHaveTextContent(JSON.stringify({registered:true,employeeName:"社員A",canViewSync:false,embedded:true}));
    fireEvent.click(screen.getByRole("tab",{name:"シフト"})); expect(screen.getByText(/シフトの提出・確認/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"前確依頼"})); expect(screen.getByRole("button",{name:"連携チェック"})).toBeInTheDocument();
  });
  it("uses the attendance query tab as the initial tab", () => {
    renderMyPage({...baseProps,initialTab:"attendance",canViewSync:true});
    expect(screen.getByRole("tab",{name:"勤怠打刻"})).toHaveAttribute("aria-selected","true");
    expect(screen.getByTestId("attendance-client")).toHaveTextContent('"canViewSync":true');
  });
  it("reveals only the profile returned after a correct unlock", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,profile}),{status:200})));
    renderMyPage();
    fireEvent.change(screen.getByLabelText("生年月日の月日4桁"),{target:{value:"0813"}});
    fireEvent.click(screen.getByRole("button",{name:"認証してマイページを開く"}));
    expect(await screen.findByText("社員A")).toBeInTheDocument();
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(requestBody).toEqual({code:"0813"});
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"シフト"}));
    fireEvent.click(screen.getByRole("tab",{name:"マイページ"}));
    expect(screen.getByText("1980-08-13")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url])=>url==="/api/system/mypage/unlock")).toHaveLength(1);
  });
  it("bypasses the gate with an explanation when birthday is missing", () => {
    renderMyPage({...baseProps,birthdayRegistered:false,initialProfile:{...profile,birthday:null}});
    expect(screen.queryByLabelText("本人確認")).not.toBeInTheDocument();
    expect(screen.getByText("生年月日が未登録のため本人確認を省略しています。")).toBeInTheDocument();
  });
  it("shows safe profile details and replaces dummy areas with preview cards", () => {
    renderMyPage({...baseProps,birthdayRegistered:false,initialProfile:{...profile,birthday:null}});
    expect(screen.getByText("緊急連絡先の登録・確認がマイページでできるようになります")).toBeInTheDocument();
    expect(screen.getByText("架電数・有効率・順位の6ヶ月推移がここで見られるようになります")).toBeInTheDocument();
    const basic = screen.getByRole("heading",{name:"基本情報"}).closest("section")!;
    expect(within(basic).getByText("交通費").parentElement).toHaveTextContent("日額 800円（月の上限 20,000円）");
    expect(within(basic).getByText("給与受取口座").parentElement).toHaveTextContent("みどり銀行 庭園支店");
    expect(within(basic).getByText("マイナンバー").parentElement).toHaveTextContent("提出済み");
    expect(screen.queryByRole("heading",{name:"設定"})).not.toBeInTheDocument();expect(screen.queryByText("通知音")).not.toBeInTheDocument();expect(screen.queryByText("パスワード変更")).not.toBeInTheDocument();
  });
  it("uses Japanese fallback labels for unregistered private profile data",()=>{renderMyPage({...baseProps,birthdayRegistered:false,initialProfile:{...profile,birthday:null,bankName:null,branchName:null,commuteDailyAllowance:null,commuteMonthlyCap:null,mynaSubmitted:false}});const basic=screen.getByRole("heading",{name:"基本情報"}).closest("section")!;expect(within(basic).getByText("交通費").parentElement).toHaveTextContent("未登録");expect(within(basic).getByText("給与受取口座").parentElement).toHaveTextContent("未登録");expect(within(basic).getByText("マイナンバー").parentElement).toHaveTextContent("未提出");});
  it("keeps the existing 90-day localStorage confirmation key", async () => {
    renderMyPage({...baseProps,birthdayRegistered:false,initialProfile:{...profile,birthday:null}});
    const button = await screen.findByRole("button",{name:"変更はありません"}); fireEvent.click(button);
    await waitFor(()=>expect(localStorage.getItem("gardenTree_mypageLastConfirm")).toMatch(/^\d{4}-/));
    expect(screen.queryByLabelText("個人情報の定期確認")).not.toBeInTheDocument();
  });
  it("switches light and dark with the header button and restores the saved choice",async()=>{const first=renderMyPage();const darkButton=await screen.findByRole("button",{name:"🌙 ダークにする"});fireEvent.click(darkButton);await waitFor(()=>expect(document.documentElement).toHaveAttribute("data-theme","dark"));expect(document.documentElement).toHaveClass("dark");expect(screen.getByRole("button",{name:"☀️ ライトにする"})).toBeInTheDocument();expect(localStorage.getItem("garden.theme")).toBe("dark");first.unmount();renderMyPage();expect(await screen.findByRole("button",{name:"☀️ ライトにする"})).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"☀️ ライトにする"}));await waitFor(()=>expect(document.documentElement).toHaveAttribute("data-theme","light"));expect(document.documentElement).not.toHaveClass("dark");});
});
