import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
vi.mock("@/app/system/forms/nhk-visit/NhkVisitClient", () => ({
  default: ({ submitterName, employeeNumber, mobile }: { submitterName: string; employeeNumber: string; mobile?: boolean }) => (
    <div data-testid="nhk-visit-client" data-mobile={String(mobile)}>
      {submitterName}/{employeeNumber}
    </div>
  ),
}));

import MobileNhkVisitPage from "./page";

function client(employee: Record<string, unknown> | null, user: Record<string, unknown> | null = { id: "U1" }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: employee, error: null }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => query),
    query,
  };
}

describe("/m/nhk page", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.redirect.mockReset();
  });

  it("redirects unauthenticated users back to the mobile form", async () => {
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirected");
    });
    mocks.createServerClient.mockResolvedValue(client(null, null));

    await expect(MobileNhkVisitPage()).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?returnTo=%2Fm%2Fnhk");
  });

  it("shows the staff-only message below staff", async () => {
    mocks.createServerClient.mockResolvedValue(client({
      name: "確認 太郎",
      employee_number: "1001",
      garden_role: "cs",
      is_active: true,
      termination_date: null,
      deleted_at: null,
    }));

    render(await MobileNhkVisitPage());

    expect(screen.getByRole("heading", { name: "この画面は社員以上が使えます" })).toBeInTheDocument();
    expect(screen.getByText("必要な場合は責任者に確認してください。")).toBeInTheDocument();
  });

  it("renders the mobile NHK visit form for staff and above", async () => {
    const supabase = client({
      name: "桐井 大輔",
      employee_number: "5678",
      garden_role: "staff",
      is_active: true,
      termination_date: null,
      deleted_at: null,
    });
    mocks.createServerClient.mockResolvedValue(supabase);

    render(await MobileNhkVisitPage());

    expect(supabase.query.select).toHaveBeenCalledWith("name,employee_number,garden_role,is_active,termination_date,deleted_at");
    expect(screen.getByTestId("nhk-visit-client")).toHaveAttribute("data-mobile", "true");
    expect(screen.getByTestId("nhk-visit-client")).toHaveTextContent("桐井 大輔/5678");
  });
});
