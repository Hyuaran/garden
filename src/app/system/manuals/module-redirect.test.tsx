import "@/lib/auth/__tests__/system-view-fixture";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error("redirect"); }), createServerClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
import Page from "./[module]/page";
it("redirects the bookmarked module URL to its tab", async () => {
  mocks.createServerClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
    from: () => ({ select() { return this; }, eq() { return this; }, is() { return this; }, maybeSingle: async () => ({ data: { garden_role: "staff" } }) })
  });
  await expect(Page({ params: Promise.resolve({ module: "system" }) })).rejects.toThrow("redirect");
  expect(mocks.redirect).toHaveBeenCalledWith("/system/manuals?tab=system");
});
