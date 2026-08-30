import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import ContractsLayout from "./layout";

function client() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn((table: string) => {
      const data = table === "root_employees"
        ? { name: "責任者A", garden_role: "manager", company_id: "COMP-001" }
        : { company_name: "株式会社A" };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data }) };
    }),
  };
}

describe("contracts layout", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); });

  it("returns only the authorized contract content", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    const child = <p>契約書本文</p>;
    expect(await ContractsLayout({ children: child })).toBe(child);
  });
});
