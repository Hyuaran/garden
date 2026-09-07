import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

describe("KanriPortalPage", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("shows a staff-only message below staff", async () => {
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: () => Promise.resolve({ data: { name: "担当 花子", garden_role: "cs" } }),
              }),
            }),
          }),
        }),
      }),
    });
    const { default: Page } = await import("./page");

    render(await Page());

    expect(screen.getByText("この画面は社員以上が使えます")).toBeInTheDocument();
  });

  it("shows only payroll tab to staff", async () => {
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: () => Promise.resolve({ data: { name: "一般 花子", garden_role: "staff" } }),
              }),
            }),
          }),
        }),
      }),
    });
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });
    const { default: Page } = await import("./page");

    render(await Page());

    expect(screen.getByRole("button", { name: "給与試算" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理表" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "計算する" })).not.toBeInTheDocument();
  });
});
