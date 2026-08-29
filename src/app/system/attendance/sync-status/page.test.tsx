import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import SyncStatusPage from "./page";

function client() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn((table: string) => {
      const data = table === "root_employees" ? { name: "責任者A", garden_role: "manager", company_id: "COMP-001" } : { company_name: "株式会社A" };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data }) };
    }),
  };
}

describe("attendance sync status page", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); });
  it("renders inside ShachoShell with attendance selected", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    const shell = await SyncStatusPage() as ReactElement<{ activePath:string; user:{name:string;company:string;role:string}; children:ReactElement }>;
    expect(shell.props).toMatchObject({ activePath:"/system/attendance", user:{name:"責任者A",company:"株式会社A",role:"manager"} });
    expect(shell.props.children.type).toBeTypeOf("function");
  });
});
