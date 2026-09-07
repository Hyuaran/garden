import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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

    const employeeQuery = supabase.from.mock.results[0].value;
    expect(employeeQuery.select).toHaveBeenCalledWith("garden_role");
    expect(screen.getByRole("heading", { name: "フォーム" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "給与計算連絡" })).toBeInTheDocument();
  });

  it("filters forms below staff", async () => {
    mocks.createServerClient.mockResolvedValue(client("cs"));

    render(await FormsHubPage());

    expect(screen.queryByRole("cell", { name: "給与計算連絡" })).not.toBeInTheDocument();
  });
});
