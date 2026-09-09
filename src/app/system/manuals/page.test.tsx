import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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

    render(await ManualsHubPage());

    const employeeQuery = supabase.from.mock.results[0].value;
    expect(employeeQuery.select).toHaveBeenCalledWith("garden_role,is_active,termination_date,deleted_at");
    expect(screen.getByRole("heading", { name: "マニュアル" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Bud" })).toBeInTheDocument();
  });

  it("filters modules below staff", async () => {
    mocks.createServerClient.mockResolvedValue(client("cs"));

    render(await ManualsHubPage());

    expect(screen.queryByRole("cell", { name: "System" })).not.toBeInTheDocument();
  });
});
