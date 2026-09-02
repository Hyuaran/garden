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

  it("shows a manager-only message to staff", async () => {
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
    const { default: Page } = await import("./page");

    render(await Page());

    expect(screen.getByText("この画面は責任者以上が使えます")).toBeInTheDocument();
  });
});
