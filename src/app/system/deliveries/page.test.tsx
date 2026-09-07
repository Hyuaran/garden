import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import DeliveriesHubPage from "./page";

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

describe("deliveries hub page", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.redirect.mockReset();
    localStorage.clear();
  });

  it("renders deliveries visible to staff", async () => {
    const supabase = client("staff");
    mocks.createServerClient.mockResolvedValue(supabase);

    render(await DeliveriesHubPage());

    const employeeQuery = supabase.from.mock.results[0].value;
    expect(employeeQuery.select).toHaveBeenCalledWith("garden_role");
    expect(screen.getByRole("heading", { name: "自動配信" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "コール数配信" })).toBeInTheDocument();
  });

  it("filters deliveries below staff", async () => {
    mocks.createServerClient.mockResolvedValue(client("cs"));

    render(await DeliveriesHubPage());

    expect(screen.queryByRole("cell", { name: "コール数配信" })).not.toBeInTheDocument();
  });
});
