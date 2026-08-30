import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import SystemLayout from "./layout";

function client(role = "manager") {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } } }) },
    from: vi.fn((table: string) => {
      const data = table === "root_employees"
        ? { name: "責任者A", garden_role: role, company_id: "COMP-001" }
        : { company_name: "株式会社A" };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data }) };
    }),
  };
}

describe("system shared layout", () => {
  beforeEach(() => { mocks.createServerClient.mockReset(); mocks.redirect.mockReset(); });

  it("renders one ShachoShell with the signed-in user", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    const child = <p>本文</p>;
    const shell = await SystemLayout({ children: child }) as ReactElement<{
      user: { name: string; company: string; role: string };
      children: ReactElement;
    }>;
    expect(shell.props.user).toEqual({ name: "責任者A", company: "株式会社A", role: "manager" });
    expect(shell.props.children).toBe(child);
  });

  it("preserves sidebarless roles for the shell", async () => {
    mocks.createServerClient.mockResolvedValue(client("closer"));
    const shell = await SystemLayout({ children: <p>本文</p> }) as ReactElement<{ user: { role: string } }>;
    expect(shell.props.user.role).toBe("closer");
  });
});
