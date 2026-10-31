import "@/lib/auth/__tests__/system-view-fixture";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
import FormsHubPage from "./page";

function client(role = "staff") {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { garden_role: role }, error: null }),
    })),
  };
}

describe("forms hub page", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.redirect.mockReset();
    localStorage.clear();
  });

  it("renders forms visible to staff", async () => {
    const supabase = client("staff");
    mocks.createServerClient.mockResolvedValue(supabase);

    render(await FormsHubPage());

    const employeeQuery = supabase.from.mock.results.map(result => result.value).find(query => query.select.mock.calls.some((call: unknown[]) => String(call[0]).includes("is_active")));
    expect(employeeQuery.select).toHaveBeenCalledWith("garden_role,is_active,termination_date,deleted_at");
    expect(screen.getByRole("heading", { name: "業務管理ツール" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "給与計算連絡" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "出勤表・シフトLINE連絡テキスト生成" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^自動で動いている/ }));
    expect(screen.getByRole("cell", { name: "INNOVERA番号の同期" })).toBeInTheDocument();
  });

  it("filters forms below staff", async () => {
    mocks.createServerClient.mockResolvedValue(client("cs"));

    render(await FormsHubPage());

    expect(screen.queryByRole("cell", { name: "給与計算連絡" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "出勤表・シフトLINE連絡テキスト生成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "INNOVERA番号の同期" })).not.toBeInTheDocument();
  });
});
