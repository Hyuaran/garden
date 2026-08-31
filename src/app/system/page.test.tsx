import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import SystemHomePage from "./page";

function client(role = "manager") {
  const employee = { garden_role: role };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn((table: string) => {
      const data = table === "root_employees" ? employee : null;
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data }) };
      return query;
    }),
  };
}

describe("system home", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false })); });
  it("links all eight manager cards to their configured destinations", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    render(await SystemHomePage());
    expect(screen.getByRole("heading", { name: "社内システム" }).previousElementSibling).toHaveTextContent("System");
    expect(screen.queryByText("SYSTEM")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "資料" }).closest("a")).toHaveAttribute("href", "/system/docs");
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
});
