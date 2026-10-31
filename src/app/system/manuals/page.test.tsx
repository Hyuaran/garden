import "@/lib/auth/__tests__/system-view-fixture";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
import ManualsHubPage from "./page";

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

describe("manuals hub page", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.redirect.mockReset();
    localStorage.clear();
  });

  it("renders modules visible to staff", async () => {
    const supabase = client("staff");
    mocks.createServerClient.mockResolvedValue(supabase);

    render(await ManualsHubPage({ searchParams: Promise.resolve({}) }));

    const employeeQuery = supabase.from.mock.results.map(result => result.value).find(query => query.select.mock.calls.some((call: unknown[]) => String(call[0]).includes("is_active")));
    expect(employeeQuery.select).toHaveBeenCalledWith("garden_role,is_active,termination_date,deleted_at");
    expect(screen.getByRole("heading", { name: "マニュアル" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bud" })).toBeInTheDocument();
  });

  it("shows operation manuals to my-page roles", async () => {
    mocks.createServerClient.mockResolvedValue(client("cs"));

    render(await ManualsHubPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("tab", { name: "System" })).toBeInTheDocument();
  });
});
