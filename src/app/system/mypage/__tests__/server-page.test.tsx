import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../_lib/mypage-profile.server", () => ({ buildMyPageProfile: async (row: Record<string, unknown>) => ({ name: row.name, birthday: null, bankName: null, branchName: null, commuteDailyAllowance: null, commuteMonthlyCap: null, mynaSubmitted: false }) }));
import MyPageSectionPage from "../_components/MyPageSectionPage";

const employee = { employee_id: "EMP-0009", name: "社員A", name_kana: "シャインエー", employee_number: "EMP-1", employment_type: "正社員", birthday: "1980-08-13", email: "a@example.com", garden_role: "staff", company_id: "COMP-001" };
function client(row: typeof employee | null = employee, user: { id: string } | null = { id: "user-1" }) {
  const from = vi.fn((table: string) => {
    const data = table === "root_employees" ? row : table === "root_companies" ? { company_name: "株式会社A" } : null;
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
  });
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, from };
}

type ShellElement = ReactElement<{
  activePath: string;
  user: { name: string; company: string; role: string };
  children: ReactElement<{
    initialProfile: unknown;
    birthdayRegistered: boolean;
    employeeName: string;
    initialTab: string;
    tabbed: boolean;
  }>;
}>;

describe("system mypage section server page", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); });

  it("keeps staff on the standalone profile and does not pass a registered birthday", async () => {
    const db = client(); mocks.createServerClient.mockResolvedValue(db);
    const shell = await MyPageSectionPage({ section: "profile" }) as ShellElement;
    expect(db.from).toHaveBeenCalledTimes(3);
    expect(shell.props).toMatchObject({ activePath: "/system/mypage", user: { name: "社員A", company: "株式会社A", role: "staff" } });
    expect(shell.props.children.props).toMatchObject({ initialTab: "profile", tabbed: false, initialProfile: null, birthdayRegistered: true, employeeName: "社員A" });
    expect(JSON.stringify(shell.props)).not.toContain("1980-08-13");
  });

  it.each(["closer", "toss", "outsource"] as const)("keeps all four tabs for sidebarless %s", async (role) => {
    mocks.createServerClient.mockResolvedValue(client({ ...employee, garden_role: role }));
    const shell = await MyPageSectionPage({ section: "profile" }) as ShellElement;
    expect(shell.props.children.props.tabbed).toBe(true);
  });

  it("opens attendance as a tab for closer and standalone for staff", async () => {
    mocks.createServerClient.mockResolvedValue(client({ ...employee, garden_role: "closer" }));
    const closer = await MyPageSectionPage({ section: "attendance" }) as ShellElement;
    expect(closer.props).toMatchObject({ activePath: "/system/attendance" });
    expect(closer.props.children.props).toMatchObject({ initialTab: "attendance", tabbed: true });

    mocks.createServerClient.mockResolvedValue(client());
    const staff = await MyPageSectionPage({ section: "attendance" }) as ShellElement;
    expect(staff.props.children.props).toMatchObject({ initialTab: "attendance", tabbed: false });
  });

  it("passes the profile only when birthday is unregistered", async () => {
    mocks.createServerClient.mockResolvedValue(client({ ...employee, birthday: null } as unknown as typeof employee));
    const shell = await MyPageSectionPage({ section: "profile" }) as ShellElement;
    expect((shell.props.children.props.initialProfile as { birthday: null }).birthday).toBeNull();
  });

  it("does not send profile data to a standalone non-profile page", async () => {
    mocks.createServerClient.mockResolvedValue(client({ ...employee, birthday: null } as unknown as typeof employee));
    const shell = await MyPageSectionPage({ section: "attendance" }) as ShellElement;
    expect(shell.props.children.props).toMatchObject({ tabbed: false, initialProfile: null });
  });

  it("preserves authentication and returns to the requested section", async () => {
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    mocks.createServerClient.mockResolvedValue(client(employee, null));
    await expect(MyPageSectionPage({ section: "shift" })).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?returnTo=%2Fsystem%2Fshift");
  });
});
