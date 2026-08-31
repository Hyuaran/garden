import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import SystemHomePage from "./page";

function client(role = "manager", status: string | null = null) {
  const employee = { employee_id: "EMP-9999", garden_role: role };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn((table: string) => {
      const data = table === "root_employees" ? employee : status ? { status } : null;
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
      query.maybeSingle.mockImplementation(async () => {
        if (table === "root_employees") {
          const missing = String(query.select.mock.lastCall?.[0] ?? "").split(",").find(column => !Object.hasOwn(employee, column.trim()));
          if (missing) return { data: null, error: { code: "42703", message: `column root_employees.${missing} does not exist` } };
        }
        return { data, error: null };
      });
      return query;
    }),
  };
}

describe("system home", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false })); });
  it("存在するemployee_idを選択し、同じtextキーで案内を判定する", async () => {
    const supabase = client(); mocks.createServerClient.mockResolvedValue(supabase);
    render(await SystemHomePage());
    const employeeQuery = supabase.from.mock.results[0].value;
    const onboardingQuery = supabase.from.mock.results[1].value;
    expect(employeeQuery.select).toHaveBeenCalledWith("employee_id,garden_role");
    expect(onboardingQuery.eq).toHaveBeenCalledWith("employee_id", "EMP-9999");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("links all nine manager cards to their configured destinations", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    render(await SystemHomePage());
    expect(screen.getByRole("heading", { name: "社内システム" }).previousElementSibling).toHaveTextContent("System");
    expect(screen.queryByText("SYSTEM")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "資料" }).closest("a")).toHaveAttribute("href", "/system/docs");
    expect(screen.getByRole("heading", { name: "入社手続き" }).closest("a")).toHaveAttribute("href", "/system/onboarding");
    expect(screen.getByRole("heading", { name: "自分の情報" }).closest("a")).toHaveAttribute("href", "/system/mypage");
    expect(screen.getByRole("heading", { name: "勤怠打刻" }).closest("a")).toHaveAttribute("href", "/system/attendance");
    expect(screen.getByRole("heading", { name: "シフト" }).closest("a")).toHaveAttribute("href", "/system/shift");
    expect(screen.getByRole("heading", { name: "前確依頼" }).closest("a")).toHaveAttribute("href", "/system/zenkaku");
    expect(screen.getByRole("heading", { name: "テレマ コール集計" }).closest("a")).toHaveAttribute("href", "/system/call-metrics");
    expect(screen.getByRole("heading", { name: "契約書管理" }).closest("a")).toHaveAttribute("href", "/system/contracts");
    expect(screen.getByRole("heading", { name: "関電トスポータル" }).closest("a")).toHaveAttribute("href", "/p/toss");
    expect(screen.getAllByText("準備中")).toHaveLength(4);
  });
  it("does not render the manager-only card for staff", async () => {
    mocks.createServerClient.mockResolvedValue(client("staff"));
    render(await SystemHomePage());
    expect(screen.queryByRole("link", { name: /契約書管理/ })).not.toBeInTheDocument();
  });
  it.each([null, "draft"])("%sはホーム上部に任意の入力案内を表示する", async status => {
    mocks.createServerClient.mockResolvedValue(client("staff", status));
    render(await SystemHomePage());
    expect(screen.getByText("入社手続きの入力がまだ終わっていません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "入力する" })).toHaveAttribute("href", "/system/onboarding");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("提出済みは案内を消すがカードは残す", async () => {
    mocks.createServerClient.mockResolvedValue(client("staff", "submitted"));
    render(await SystemHomePage());
    expect(screen.queryByText("入社手続きの入力がまだ終わっていません")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "入社手続き" })).toBeInTheDocument();
  });
});
