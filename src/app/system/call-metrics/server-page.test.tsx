import "@/lib/auth/__tests__/system-view-fixture";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
import CallMetricsPage from "./page";

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

describe("call metrics server page", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); });

  it("returns only the authorized call metrics content", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    const page = await CallMetricsPage() as ReactElement;
    expect(page.type).toBeTypeOf("function");
  });
});
